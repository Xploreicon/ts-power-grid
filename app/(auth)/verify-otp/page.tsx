"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui";
import { OTPInput } from "@/components/ui/otp-input";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/toast";

type Method = "phone" | "email";

function VerifyOtpContent() {
  const router = useRouter();
  const params = useSearchParams();
  const method: Method = params.get("method") === "email" ? "email" : "phone";
  const otpToken = params.get("token") ?? "";
  const email = params.get("email") ?? "";
  const phone = params.get("phone") ?? "";

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Redirect back if we don't have what we need for the chosen method.
  useEffect(() => {
    if (method === "phone" && !otpToken) router.replace("/sign-in");
    if (method === "email" && !email) router.replace("/sign-in");
  }, [method, otpToken, email, router]);

  // Resend countdown.
  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const routeAfterVerify = async (supabase: ReturnType<typeof createClient>, isNewUser: boolean) => {
    if (isNewUser) {
      router.replace("/onboarding");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/sign-in");
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.full_name) {
      router.replace("/onboarding");
    } else if (profile.role === "admin" || profile.role === "super_admin") {
      router.replace("/admin");
    } else {
      router.replace("/host/home");
    }
  };

  const handleVerifyPhone = async () => {
    const res = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otpToken, code }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Invalid code");
      setCode("");
      return;
    }
    const supabase = createClient();
    const { error: sessionErr } = await supabase.auth.verifyOtp({
      token_hash: data.tokenHash,
      type: "magiclink",
    });
    if (sessionErr) {
      setError("Session exchange failed — please try again.");
      return;
    }
    toast.success("Verified!", "You're now signed in.");
    await routeAfterVerify(supabase, !!data.isNewUser);
  };

  const handleVerifyEmail = async () => {
    const supabase = createClient();
    const { data, error: verifyErr } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    if (verifyErr || !data.user) {
      setError(verifyErr?.message ?? "Invalid code");
      setCode("");
      return;
    }

    // Ensure a profile row exists. Supabase only creates auth.users on first
    // email verify; our app keeps a separate profiles row (trigger provisions
    // the wallet). Insert if missing.
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("id", data.user.id)
      .maybeSingle();

    let isNewUser = false;
    if (!profile) {
      isNewUser = true;
      const { error: insertErr } = await supabase.from("profiles").insert({
        id: data.user.id,
        email,
        role: "neighbor",
      });
      if (insertErr) {
        // Most common cause: RLS or duplicate; log and continue. Onboarding
        // will retry the profile update.
        console.error("[verify-otp] profile insert failed:", insertErr);
      }
    } else if (!profile.full_name) {
      isNewUser = true;
    }

    toast.success("Verified!", "You're now signed in.");
    await routeAfterVerify(supabase, isNewUser);
  };

  const handleVerify = async () => {
    if (code.length < 6) {
      setError("Enter all 6 digits");
      return;
    }
    setError("");
    setLoading(true);
    try {
      if (method === "email") {
        await handleVerifyEmail();
      } else {
        await handleVerifyPhone();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setCanResend(false);
    setCountdown(60);
    setCode("");
    setError("");

    try {
      if (method === "email") {
        if (!email) {
          router.replace("/sign-in");
          return;
        }
        const supabase = createClient();
        const { error: otpErr } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: true },
        });
        if (otpErr) {
          setError(otpErr.message);
          return;
        }
        toast.info("New code sent", "Check your email.");
      } else {
        if (!phone) {
          router.replace("/sign-in");
          return;
        }
        const res = await fetch("/api/auth/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Resend failed");
          return;
        }
        router.replace(
          `/verify-otp?method=phone&token=${encodeURIComponent(data.otpToken)}&phone=${encodeURIComponent(phone)}`,
        );
        toast.info("New code sent", "Check your messages.");
      }
    } catch {
      setError("Resend failed — try again.");
    }
  };

  const destinationLabel = method === "email" ? email : "your phone";

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-display font-bold text-navy-950">
          Enter your code
        </h1>
        <p className="text-navy-600 font-sans text-sm">
          A 6-digit code was sent to{" "}
          <span className="font-semibold text-navy-900">
            {destinationLabel}
          </span>
          . It expires in 5 minutes.
        </p>
      </div>

      <div className="space-y-4">
        <OTPInput
          value={code}
          onChange={setCode}
          disabled={loading}
          error={!!error}
          autoFocus
        />
        {error && <p className="text-sm font-medium text-red-500">{error}</p>}
      </div>

      <Button
        size="lg"
        className="w-full h-14 text-base font-bold"
        onClick={handleVerify}
        loading={loading}
        disabled={code.length < 6}
      >
        Verify Code
      </Button>

      <div className="text-center">
        {canResend ? (
          <button
            onClick={handleResend}
            className="text-sm font-semibold text-navy-700 underline underline-offset-4 hover:text-navy-950"
          >
            Resend code
          </button>
        ) : (
          <p className="text-sm text-navy-400 font-sans">
            Resend in{" "}
            <span className="font-mono font-bold text-navy-700">
              {countdown}s
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense
      fallback={<div className="h-64 animate-pulse bg-navy-50 rounded-2xl" />}
    >
      <VerifyOtpContent />
    </Suspense>
  );
}
