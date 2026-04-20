"use client";

import React, { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui";

type Props = {
  /** Amount to top up, in kobo. */
  amountKobo: number;
  /** Optional label; defaults to "Top up wallet". */
  label?: string;
  /** Called after Paystack redirects back and verify succeeds. */
  onSuccess?: () => void;
  className?: string;
  variant?: "primary" | "secondary";
};

/**
 * Launches a Paystack checkout for a wallet top-up.
 *
 * Uses the redirect flow (authorization_url) rather than the Popup SDK —
 * redirect works reliably across Safari/PWA/in-app webviews that the Popup
 * sometimes breaks in. The page we redirect to is PAYSTACK_CALLBACK_URL
 * (server-configured), which should land on /payments/callback to run verify.
 */
export function TopupButton({
  amountKobo,
  label = "Top up wallet",
  onSuccess,
  className,
  variant = "primary",
}: Props) {
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    if (amountKobo < 100) {
      toast.error("Top-up amount too small.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "topup", amount_kobo: amountKobo }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not start payment");
        return;
      }
      // Stash the reference so the callback page can pick it up if Paystack
      // omits it from the redirect URL.
      if (typeof window !== "undefined") {
        sessionStorage.setItem("paystack_pending_ref", data.reference);
      }
      onSuccess?.();
      window.location.href = data.authorization_url;
    } catch {
      toast.error("Network error — try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      className={className}
      onClick={onClick}
      disabled={loading}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Starting payment…
        </>
      ) : (
        <>
          <Plus className="h-4 w-4 mr-2" />
          {label}
        </>
      )}
    </Button>
  );
}
