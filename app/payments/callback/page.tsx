"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui";

type Status = "verifying" | "success" | "failed";

function CallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<Status>("verifying");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const reference =
      params.get("reference") ||
      params.get("trxref") ||
      (typeof window !== "undefined"
        ? sessionStorage.getItem("paystack_pending_ref")
        : null);

    if (!reference) {
      setStatus("failed");
      setMessage("No transaction reference found.");
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference }),
        });
        const data = await res.json();
        if (!res.ok) {
          setStatus("failed");
          setMessage(data.error ?? "Verification failed");
          return;
        }
        if (data.status === "success") {
          setStatus("success");
          setMessage(`Payment confirmed — ₦${(data.amountKobo / 100).toLocaleString()}.`);
          sessionStorage.removeItem("paystack_pending_ref");
        } else {
          setStatus("failed");
          setMessage(data.gatewayResponse ?? `Payment ${data.status}.`);
        }
      } catch {
        setStatus("failed");
        setMessage("Network error — please check your wallet for status.");
      }
    })();
  }, [params]);

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center space-y-6">
      {status === "verifying" && (
        <>
          <Loader2 className="mx-auto h-12 w-12 text-navy-600 animate-spin" />
          <h1 className="text-2xl font-display font-bold text-navy-950">
            Verifying payment…
          </h1>
          <p className="text-navy-600 font-sans text-sm">
            Hang on — we&apos;re confirming with Paystack.
          </p>
        </>
      )}
      {status === "success" && (
        <>
          <CheckCircle2 className="mx-auto h-14 w-14 text-green-500" />
          <h1 className="text-2xl font-display font-bold text-navy-950">
            Payment successful
          </h1>
          <p className="text-navy-600 font-sans text-sm">{message}</p>
          <Button
            size="lg"
            className="w-full h-12 font-bold"
            onClick={() => router.replace("/host/home")}
          >
            Back to dashboard
          </Button>
        </>
      )}
      {status === "failed" && (
        <>
          <XCircle className="mx-auto h-14 w-14 text-red-500" />
          <h1 className="text-2xl font-display font-bold text-navy-950">
            Something went wrong
          </h1>
          <p className="text-navy-600 font-sans text-sm">{message}</p>
          <Button
            variant="secondary"
            className="w-full h-12 font-bold"
            onClick={() => router.replace("/host/home")}
          >
            Back to dashboard
          </Button>
        </>
      )}
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-md mx-auto py-16 text-center">
          <Loader2 className="mx-auto h-12 w-12 text-navy-600 animate-spin" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
