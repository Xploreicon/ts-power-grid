"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";

type Method = "phone" | "email";

export default function SignInPage() {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email address");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { shouldCreateUser: true },
      });
      if (otpErr) {
        setError(otpErr.message);
        return;
      }
      router.push(
        `/verify-otp?method=email&email=${encodeURIComponent(trimmed)}`,
      );
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
          Choose how you&apos;d like to receive your one-time code. New users
          are guided through onboarding after verification.
        </p>
      </div>

      {/* Method tabs */}
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
            hint="Must be a Nigerian mobile number"
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
        <form onSubmit={handleSendEmail} className="space-y-6">
          <Input
            label="Email Address"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error}
            hint="We'll email you a 6-digit code"
            autoComplete="email"
            disabled={loading}
          />
          <Button
            type="submit"
            size="lg"
            className="w-full h-14 text-base font-bold"
            loading={loading}
          >
            Send code
          </Button>
        </form>
      )}

      <div className="rounded-[12px] border border-navy-100 bg-offwhite p-4 text-sm text-navy-700 font-sans">
        <p className="font-semibold text-navy-900">New to T&amp;S Power Grid?</p>
        <p className="mt-1 text-navy-600">
          Enter your phone number or email above to create an account. After
          verifying the code, we&apos;ll walk you through host onboarding
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
