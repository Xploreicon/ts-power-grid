"use client";

import React, { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

type Bank = { name: string; code: string; slug: string };

type Step = "amount" | "bank" | "review" | "done";

type Props = {
  availableBalanceKobo: number;
  minKobo: number;
  /** Prefilled bank details from profile, if any. */
  initial?: {
    bankCode?: string;
    accountNumber?: string;
  };
  onComplete?: () => void;
};

/**
 * Multi-step withdrawal UI:
 *   1. amount — choose how much.
 *   2. bank — pick bank + enter 10-digit NUBAN, resolve to name via Paystack.
 *   3. review — confirm and submit.
 *   4. done — success screen; webhook finalises debit.
 */
export function WithdrawFlow({
  availableBalanceKobo,
  minKobo,
  initial,
  onComplete,
}: Props) {
  const [step, setStep] = useState<Step>("amount");
  const [amountNgn, setAmountNgn] = useState("");
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankCode, setBankCode] = useState(initial?.bankCode ?? "");
  const [accountNumber, setAccountNumber] = useState(
    initial?.accountNumber ?? "",
  );
  const [resolvedName, setResolvedName] = useState("");
  const [resolving, setResolving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Load banks once when entering bank step.
  useEffect(() => {
    if (step !== "bank" || banks.length) return;
    fetch("/api/paystack/banks")
      .then((r) => r.json())
      .then((d) => setBanks(d.banks ?? []))
      .catch(() => toast.error("Could not load banks"));
  }, [step, banks.length]);

  // Auto-resolve when account + bank are present & valid.
  useEffect(() => {
    if (step !== "bank") return;
    setResolvedName("");
    setError("");
    if (!bankCode || !/^\d{10}$/.test(accountNumber)) return;
    setResolving(true);
    const ctrl = new AbortController();
    fetch(
      `/api/paystack/resolve-account?account_number=${accountNumber}&bank_code=${bankCode}`,
      { signal: ctrl.signal },
    )
      .then((r) => r.json())
      .then((d) => {
        if (d.account_name) setResolvedName(d.account_name);
        else setError(d.error ?? "Could not resolve account");
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError("Resolve failed");
      })
      .finally(() => setResolving(false));
    return () => ctrl.abort();
  }, [step, bankCode, accountNumber]);

  const amountKobo = Math.round((parseFloat(amountNgn) || 0) * 100);
  const amountValid = amountKobo >= minKobo && amountKobo <= availableBalanceKobo;

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/payments/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_kobo: amountKobo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Withdrawal failed");
        return;
      }
      setStep("done");
      onComplete?.();
    } catch {
      setError("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {step === "amount" && (
        <div className="space-y-5">
          <div className="rounded-[12px] border border-navy-100 bg-white p-4 flex items-center gap-3">
            <Wallet className="h-5 w-5 text-navy-500" />
            <div>
              <p className="text-xs text-navy-400 uppercase tracking-widest font-mono">
                Available
              </p>
              <p className="font-mono text-lg font-bold text-navy-900">
                ₦{(availableBalanceKobo / 100).toLocaleString()}
              </p>
            </div>
          </div>
          <Input
            label="Amount (₦)"
            type="number"
            inputMode="decimal"
            placeholder="5000"
            value={amountNgn}
            onChange={(e) => setAmountNgn(e.target.value)}
            hint={`Minimum ₦${(minKobo / 100).toLocaleString()}`}
          />
          <Button
            size="lg"
            className="w-full h-12 font-bold"
            disabled={!amountValid}
            onClick={() => setStep("bank")}
          >
            Continue
          </Button>
        </div>
      )}

      {step === "bank" && (
        <div className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-navy-900">Bank</label>
            <select
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
              className={cn(
                "h-11 w-full rounded-[12px] border border-navy-200 bg-white px-3 text-sm",
              )}
            >
              <option value="">Select bank…</option>
              {banks.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Account Number"
            placeholder="0123456789"
            inputMode="numeric"
            maxLength={10}
            value={accountNumber}
            onChange={(e) =>
              setAccountNumber(e.target.value.replace(/\D/g, ""))
            }
            hint="10-digit NUBAN"
          />
          {resolving && (
            <p className="text-sm text-navy-500 flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Resolving…
            </p>
          )}
          {resolvedName && (
            <div className="rounded-[12px] border border-green-200 bg-green-50 p-3 flex items-start gap-2">
              <ShieldCheck className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="text-xs text-green-700 uppercase tracking-widest font-mono">
                  Account Name
                </p>
                <p className="font-semibold text-navy-900">{resolvedName}</p>
              </div>
            </div>
          )}
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button
            size="lg"
            className="w-full h-12 font-bold"
            disabled={!resolvedName}
            onClick={() => setStep("review")}
          >
            Continue
          </Button>
          <button
            className="w-full text-sm text-navy-500 underline"
            onClick={() => setStep("amount")}
          >
            Back
          </button>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-navy-100 bg-white p-5 space-y-3">
            <Row
              label="Amount"
              value={`₦${(amountKobo / 100).toLocaleString()}`}
            />
            <Row label="Account" value={resolvedName} />
            <Row
              label="Bank"
              value={banks.find((b) => b.code === bankCode)?.name ?? bankCode}
            />
            <Row label="Account No." value={accountNumber} />
            <p className="text-xs text-navy-400 pt-2 border-t border-navy-100">
              Funds arrive within 1–2 business days. Your wallet will be
              debited only after Paystack confirms the transfer.
            </p>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button
            size="lg"
            className="w-full h-12 font-bold"
            loading={submitting}
            onClick={submit}
          >
            Confirm withdrawal
          </Button>
          <button
            className="w-full text-sm text-navy-500 underline"
            onClick={() => setStep("bank")}
          >
            Back
          </button>
        </div>
      )}

      {step === "done" && (
        <div className="text-center space-y-4 py-8">
          <div className="mx-auto h-14 w-14 rounded-full bg-green-50 flex items-center justify-center">
            <ShieldCheck className="h-7 w-7 text-green-600" />
          </div>
          <h3 className="text-xl font-display font-bold text-navy-950">
            Withdrawal initiated
          </h3>
          <p className="text-sm text-navy-600 font-sans">
            Funds will arrive within 1–2 business days.
          </p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-navy-500">{label}</span>
      <span className="font-semibold text-navy-900">{value}</span>
    </div>
  );
}
