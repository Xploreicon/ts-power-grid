"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { toast } from "@/components/ui/toast";

export default function SignInPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async (e: React.FormEvent) => {
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
      // Navigate to verify, pass token via search param.
      router.push(`/verify-otp?token=${encodeURIComponent(data.otpToken)}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-display font-bold text-navy-950">Welcome back</h1>
        <p className="text-navy-600 font-sans">
          Enter your Nigerian phone number. We&apos;ll send a one-time code.
        </p>
      </div>

      <form onSubmit={handleSend} className="space-y-6">
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

      <p className="text-center text-sm text-navy-400 font-sans">
        Admin?{" "}
        <a href="/admin/sign-in" className="text-navy-700 underline underline-offset-4">
          Sign in with email
        </a>
      </p>
    </div>
  );
}
