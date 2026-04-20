"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/toast";

export default function AdminSignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInErr) { setError(signInErr.message); return; }

      const userId = data.user?.id;
      if (!userId) { setError("Sign-in failed — no user returned"); return; }

      // Verify admin role.
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (!profile || !["admin", "super_admin"].includes(profile.role)) {
        await supabase.auth.signOut();
        setError("Access denied — not an admin account.");
        return;
      }

      toast.success("Welcome back.", "Redirecting to dashboard.");
      router.replace("/admin");
    } catch {
      setError("Unexpected error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* Brand mark */}
        <Link href="/" className="flex items-center space-x-2 mb-2">
          <div className="h-8 w-8 rounded-lg bg-yellow-500 flex items-center justify-center">
            <div className="h-4 w-4 rounded-sm bg-navy-950" />
          </div>
          <span className="font-display text-xl font-bold text-white">T&S Power Grid</span>
        </Link>

        <div className="space-y-1">
          <h1 className="text-3xl font-display font-bold text-white">Admin portal</h1>
          <p className="text-navy-300 font-sans text-sm">Internal access only.</p>
        </div>

        <form onSubmit={handleSignIn} className="space-y-5">
          <Input
            label="Email address"
            type="email"
            placeholder="admin@tspowergrid.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error}
            disabled={loading}
            className="bg-navy-900 border-navy-700 text-white placeholder:text-navy-500 focus-visible:ring-yellow-500"
          />
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-navy-100 font-sans">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="flex h-11 w-full rounded-[12px] border border-navy-700 bg-navy-900 px-4 py-2 text-sm text-white placeholder:text-navy-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:ring-offset-0 transition-all font-sans"
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full h-14 text-base font-bold bg-yellow-500 text-navy-950 hover:bg-yellow-400"
            loading={loading}
          >
            Sign in
          </Button>
        </form>

        <p className="text-center text-sm text-navy-500">
          Not an admin?{" "}
          <Link href="/sign-in" className="text-navy-300 underline underline-offset-4">
            Phone sign-in
          </Link>
        </p>
      </div>
    </div>
  );
}
