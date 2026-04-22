"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/cn";

type Method = "phone" | "email";

async function routeByProfile(
  supabase: ReturnType<typeof createClient>,
  router: ReturnType<typeof useRouter>,
) {
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
}

export default function SignInPage() {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ── Phone + OTP (primary) ─────────────────────────────────── */
  const handleSendPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!phone.trim()) {
      setError("Phone number is required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to send OTP");
        return;
      }
      router.push(
        `/verify-otp?method=phone&token=${encodeURIComponent(data.otpToken)}&phone=${encodeURIComponent(phone)}`,
      );
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Email + Password (secondary) ──────────────────────────── */
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email address");
      return;
    }
    if (!password) {
      setError("Password is required");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: trimmed,
        password,
      });
      if (signInErr) {
        setError(signInErr.message);
        return;
      }
      toast.success("Signed in!", "Redirecting…");
      await routeByProfile(supabase, router);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-display font-bold text-navy-950">
          Sign in or create account
        </h1>
        <p className="text-navy-600 font-sans">
          Use your phone number (primary) or email &amp; password to sign in.
          New users are guided through onboarding after verification.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Sign-in method"
        className="grid grid-cols-2 rounded-[12px] border border-navy-100 bg-white p-1"
      >
        {(
          [
            { value: "phone", label: "Phone" },
            { value: "email", label: "Email" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.value}
            role="tab"
            aria-selected={method === opt.value}
            type="button"
            onClick={() => {
              setMethod(opt.value);
              setError("");
            }}
            className={cn(
              "h-10 rounded-[8px] text-sm font-semibold transition-all",
              method === opt.value
                ? "bg-navy-950 text-white"
                : "text-navy-600 hover:bg-navy-50",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {method === "phone" ? (
        <form onSubmit={handleSendPhone} className="space-y-6">
          <Input
            label="Phone Number"
            variant="phone"
            placeholder="812 000 0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={error}
            hint="Must be a Nigerian mobile number — we'll send a 6-digit code"
            autoComplete="tel"
            disabled={loading}
          />
          <Button
            type="submit"
            size="lg"
            className="w-full h-14 text-base font-bold"
            loading={loading}
          >
            Send OTP
          </Button>
        </form>
      ) : (
        <form onSubmit={handleEmailSignIn} className="space-y-5">
          <Input
            label="Email Address"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            disabled={loading}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-navy-900 font-sans">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="flex h-11 w-full rounded-[12px] border border-navy-200 bg-white px-4 py-2 text-sm text-navy-950 placeholder:text-navy-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:ring-offset-0 transition-all font-sans"
            />
          </div>
          {error && (
            <p className="text-sm font-medium text-red-500">{error}</p>
          )}
          <Button
            type="submit"
            size="lg"
            className="w-full h-14 text-base font-bold"
            loading={loading}
          >
            Sign in
          </Button>
          <p className="text-center text-sm text-navy-500 font-sans">
            Don&apos;t have an account?{" "}
            <Link
              href="/sign-up"
              className="text-navy-700 font-semibold underline underline-offset-4"
            >
              Create account
            </Link>
          </p>
        </form>
      )}

      <div className="rounded-[12px] border border-navy-100 bg-offwhite p-4 text-sm text-navy-700 font-sans">
        <p className="font-semibold text-navy-900">New to T&amp;S Power Grid?</p>
        <p className="mt-1 text-navy-600">
          Enter your phone number above to create an account, or{" "}
          <Link href="/sign-up" className="underline underline-offset-4">
            sign up with email
          </Link>
          . After verification, we&apos;ll walk you through host onboarding
          (site, bank, KYC).
        </p>
      </div>

      <p className="text-center text-sm text-navy-400 font-sans">
        Admin?{" "}
        <a
          href="/admin/sign-in"
          className="text-navy-700 underline underline-offset-4"
        >
          Sign in with email + password
        </a>
      </p>
    </div>
  );
}
