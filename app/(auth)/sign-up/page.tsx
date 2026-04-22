"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/toast";

export default function SignUpPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmationPending, setConfirmationPending] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // --- Validation ---
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      setError("Full name is required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Enter a valid email address");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: { full_name: trimmedName },
        },
      });

      if (signUpErr) {
        setError(signUpErr.message);
        return;
      }

      // If Supabase requires email confirmation the session will be null and
      // `data.user.identities` will be empty.
      const needsConfirmation =
        !data.session &&
        data.user &&
        (!data.user.identities || data.user.identities.length === 0 || !data.user.confirmed_at);

      if (needsConfirmation) {
        setConfirmationPending(true);
        return;
      }

      // Session is live — ensure profile row exists then route.
      if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", data.user.id)
          .maybeSingle();

        if (!profile) {
          await supabase.from("profiles").insert({
            id: data.user.id,
            email: trimmedEmail,
            full_name: trimmedName,
            role: "host",
          });
        }
      }

      toast.success("Account created!", "Welcome to T&S Power Grid.");
      router.replace("/onboarding");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Email confirmation pending screen ──────────────────────── */
  if (confirmationPending) {
    return (
      <div className="space-y-8">
        <div className="h-14 w-14 rounded-full bg-green-50 flex items-center justify-center">
          <CheckCircle className="h-7 w-7 text-green-600" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-display font-bold text-navy-950">
            Check your email
          </h1>
          <p className="text-navy-600 font-sans">
            We sent a confirmation link to{" "}
            <span className="font-semibold text-navy-900">
              {email.trim().toLowerCase()}
            </span>
            . Click it to activate your account, then come back and sign in.
          </p>
        </div>
        <div className="rounded-[12px] border border-navy-100 bg-offwhite p-4 text-sm text-navy-600 font-sans">
          <p className="font-semibold text-navy-900 mb-1">
            💡 Tip: Disable email confirmation for faster testing
          </p>
          <p>
            In your Supabase Dashboard → Authentication → Providers → Email,
            toggle <strong>OFF</strong> &quot;Confirm email&quot;. This lets
            sign-ups go straight through without waiting for a confirmation
            email.
          </p>
        </div>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => router.replace("/sign-in")}
        >
          Back to sign in
        </Button>
      </div>
    );
  }

  /* ── Sign-up form ───────────────────────────────────────────── */
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-display font-bold text-navy-950">
          Create your account
        </h1>
        <p className="text-navy-600 font-sans">
          Sign up with your email and password. After creating your account,
          you&apos;ll go through a quick onboarding to set up your host profile.
        </p>
      </div>

      <form onSubmit={handleSignUp} className="space-y-5">
        <Input
          label="Full Name"
          type="text"
          placeholder="Tunde Bakare"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="name"
          disabled={loading}
        />

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
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            className="flex h-11 w-full rounded-[12px] border border-navy-200 bg-white px-4 py-2 text-sm text-navy-950 placeholder:text-navy-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:ring-offset-0 transition-all font-sans"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-navy-900 font-sans">
            Confirm Password
          </label>
          <input
            type="password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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
          Create account
        </Button>
      </form>

      <p className="text-center text-sm text-navy-500 font-sans">
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="text-navy-700 font-semibold underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>

      <p className="text-center text-sm text-navy-400 font-sans">
        Prefer phone?{" "}
        <Link
          href="/sign-in"
          className="text-navy-700 underline underline-offset-4"
        >
          Sign in with phone + OTP
        </Link>
      </p>
    </div>
  );
}
