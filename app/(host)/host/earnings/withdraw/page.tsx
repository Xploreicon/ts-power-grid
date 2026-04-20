"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useWallet } from "@/lib/hooks/host/useWallet";
import { useUser } from "@/lib/hooks/useUser";
import { Button, Input, Skeleton } from "@/components/ui";
import { formatNgn, koboToNgn } from "@/lib/utils/money";
import { useQueryClient } from "@tanstack/react-query";

const MIN_WITHDRAW_KOBO = 100_000; // ₦1,000 minimum

const schema = z.object({
  amount: z
    .number()
    .min(koboToNgn(MIN_WITHDRAW_KOBO), `Minimum withdrawal is ${formatNgn(MIN_WITHDRAW_KOBO)}`),
});

type FormValues = z.infer<typeof schema>;

export default function WithdrawPage() {
  const router = useRouter();
  const profile = useUser();
  const queryClient = useQueryClient();
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const [submitting, setSubmitting] = useState(false);

  const balanceNgn = wallet ? koboToNgn(wallet.balance) : 0;

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormValues) => {
    if (!profile?.id) return;
    const amountKobo = Math.round(values.amount * 100);

    if (amountKobo > (wallet?.balance ?? 0)) {
      toast.error("Amount exceeds your available balance.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/payments/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_kobo: amountKobo }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Withdrawal failed");
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["wallet", profile.id] });
      queryClient.invalidateQueries({
        queryKey: ["transactions", profile.id],
      });
      toast.success(
        "Withdrawal initiated — funds will arrive within 1–2 business days.",
      );
      router.push("/host/earnings");
    } catch (err) {
      console.error(err);
      toast.error("Withdrawal failed. Try again or contact support.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-navy-400 hover:text-navy-700 text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Earnings
      </button>

      <div className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-widest font-mono text-navy-400 mb-1">
          Wallet
        </p>
        <h1 className="text-2xl font-display font-bold text-navy-900">
          Withdraw Funds
        </h1>
      </div>

      {/* Balance display */}
      <div className="bg-navy-950 rounded-2xl p-5 mb-6">
        <p className="text-[10px] text-navy-400 font-mono uppercase tracking-widest mb-1">
          Available Balance
        </p>
        {walletLoading ? (
          <Skeleton className="h-9 w-40 bg-navy-800" />
        ) : (
          <p className="text-3xl font-mono font-bold text-white leading-none">
            {wallet ? formatNgn(wallet.balance) : "₦0.00"}
          </p>
        )}
      </div>

      {/* Bank account reminder */}
      {profile && (!profile.bank_account_number || !profile.bank_name) && (
        <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-[12px] p-4 mb-5">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              Bank account not set
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Add your bank details in Settings before withdrawing.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-2 border-amber-300 text-amber-700 hover:bg-amber-100"
              onClick={() => router.push("/host/settings")}
            >
              Go to Settings
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-navy-700 mb-1.5">
            Amount (₦)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400 text-sm font-mono pointer-events-none">
              ₦
            </span>
            <Input
              type="number"
              step="0.01"
              className="pl-7 font-mono"
              placeholder="0.00"
              {...register("amount", { valueAsNumber: true })}
            />
          </div>
          {errors.amount && (
            <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>
          )}
          {/* Quick-fill buttons */}
          <div className="flex gap-2 mt-2">
            {[5000, 10000, 20000].map((ngn) => (
              <button
                key={ngn}
                type="button"
                onClick={() => setValue("amount", ngn)}
                className="flex-1 py-1.5 text-xs font-mono font-bold text-navy-500 bg-navy-50 rounded-lg hover:bg-navy-100 transition-colors"
              >
                ₦{ngn.toLocaleString("en-NG")}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setValue("amount", balanceNgn)}
              className="flex-1 py-1.5 text-xs font-mono font-bold text-navy-500 bg-navy-50 rounded-lg hover:bg-navy-100 transition-colors"
            >
              All
            </button>
          </div>
        </div>

        {/* Destination */}
        {profile?.bank_name && profile.bank_account_number && (
          <div className="bg-navy-50 rounded-[12px] p-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-navy-400 mb-1">
              Destination
            </p>
            <p className="text-sm font-medium text-navy-900">
              {profile.bank_name}
            </p>
            <p className="text-xs font-mono text-navy-500 mt-0.5">
              {profile.bank_account_number} ·{" "}
              {profile.bank_account_name ?? ""}
            </p>
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={
            submitting ||
            walletLoading ||
            !profile?.bank_account_number
          }
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing…
            </>
          ) : (
            "Initiate Withdrawal"
          )}
        </Button>
        <p className="text-center text-xs text-navy-400">
          Funds arrive in 1–2 business days. Minimum{" "}
          {formatNgn(MIN_WITHDRAW_KOBO)}.
        </p>
      </form>
    </div>
  );
}
