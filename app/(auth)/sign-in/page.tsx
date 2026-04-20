"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
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
  const [emailSent, setEmailSent] = useState<string | null>(null);

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
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${origin}/auth/callback`,
        },
      });
      if (otpErr) {
        setError(otpErr.message);
        return;
      }
      setEmailSent(trimmed);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="space-y-8">
        <div className="h-14 w-14 rounded-full bg-green-50 flex items-center justify-center">
          <Mail className="h-7 w-7 text-green-600" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-display font-bold text-navy-950">
            Check your email
          </h1>
          <p className="text-navy-600 font-sans">
            We sent a sign-in link to{" "}
            <span className="font-semibold text-navy-900">{emailSent}</span>.
            Click the link to continue — it expires in 1 hour.
          </p>
        </div>
        <div className="rounded-[12px] border border-navy-100 bg-offwhite p-4 text-sm text-navy-600 font-sans">
          No email in 2 minutes? Check spam, or try again with your phone
          number.
        </div>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => {
            setEmailSent(null);
            setEmail("");
          }}
        >
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-display font-bold text-navy-950">
          Sign in or create account
        </h1>
        <p className="text-navy-600 font-sans">
          Choose how you&apos;d like to receive your sign-in link. New users
          are guided through onboarding after verification.
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
        <form onSubmit={handleSendEmail} className="space-y-6">
          <Input
            label="Email Address"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error}
            hint="We'll email you a secure sign-in link"
            autoComplete="email"
            disabled={loading}
          />
          <Button
            type="submit"
            size="lg"
            className="w-full h-14 text-base font-bold"
            loading={loading}
          >
            Send sign-in link
          </Button>
        </form>
      )}

      <div className="rounded-[12px] border border-navy-100 bg-offwhite p-4 text-sm text-navy-700 font-sans">
        <p className="font-semibold text-navy-900">New to T&amp;S Power Grid?</p>
        <p className="mt-1 text-navy-600">
          Enter your phone number or email above to create an account. After
          verification, we&apos;ll walk you through host onboarding (site,
          bank, KYC).
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
