"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui";
import { OTPInput } from "@/components/ui/otp-input";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/toast";

function VerifyOtpContent() {
  const router = useRouter();
  const params = useSearchParams();
  const otpToken = params.get("token") ?? "";
  const phone = params.get("phone") ?? "";

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (!otpToken) router.replace("/sign-in");
  }, [otpToken, router]);

  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const routeAfterVerify = async (
    supabase: ReturnType<typeof createClient>,
    isNewUser: boolean,
  ) => {
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
    if (!profile?.full_name) router.replace("/onboarding");
    else if (profile.role === "admin" || profile.role === "super_admin")
      router.replace("/admin");
    else router.replace("/host/home");
  };

  const handleVerify = async () => {
    if (code.length < 6) {
      setError("Enter all 6 digits");
      return;
    }
    setError("");
    setLoading(true);
    try {
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
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!phone) {
      router.replace("/sign-in");
      return;
    }
    setCanResend(false);
    setCountdown(60);
    setCode("");
    setError("");
    try {
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
        `/verify-otp?token=${encodeURIComponent(data.otpToken)}&phone=${encodeURIComponent(phone)}`,
      );
      toast.info("New code sent", "Check your messages.");
    } catch {
      setError("Resend failed — try again.");
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-display font-bold text-navy-950">
          Enter your code
        </h1>
        <p className="text-navy-600 font-sans text-sm">
          A 6-digit code was sent to your phone. It expires in 5 minutes.
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
