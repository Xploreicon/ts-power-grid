import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AUDIT_EVENT, MIN_WITHDRAWAL_KOBO } from "./config";

/**
 * Withdrawal flow (hold-based):
 *
 *   initiateWithdrawal  → creates a pending transaction; wallet balance
 *                         unchanged. Available balance = balance −
 *                         Σ pending withdrawals (enforced in SQL).
 *   completeWithdrawal  → marks success and debits the wallet.
 *   failWithdrawal      → marks failed; no balance change.
 *
 * The debit is deferred so a failed Paystack transfer never requires a
 * compensating refund — the money simply never moved.
 */

export const initiateSchema = z.object({
  userId: z.string().uuid(),
  amountKobo: z.number().int().min(MIN_WITHDRAWAL_KOBO),
});

export const completeSchema = z.object({
  withdrawalId: z.string().uuid(),
  paystackTransferReference: z.string().min(3),
});

export const failSchema = z.object({
  withdrawalId: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

/**
 * Create a pending withdrawal. Returns the transaction id the caller
 * should persist on any downstream Paystack transfer record so the
 * completion webhook can correlate back.
 *
 * Throws `WithdrawValidationError` on bad input and
 * `WithdrawProcessingError` on RPC failure (e.g. insufficient funds).
 */
export async function initiateWithdrawal(
  supabase: SupabaseClient,
  input: unknown,
): Promise<{ withdrawalId: string }> {
  const parsed = initiateSchema.safeParse(input);
  if (!parsed.success) {
    throw new WithdrawValidationError(parsed.error.message);
  }
  const { userId, amountKobo } = parsed.data;

  const { data, error } = await supabase.rpc("request_withdrawal", {
    p_user_id: userId,
    p_amount_kobo: amountKobo,
  });
  if (error) {
    await supabase.from("billing_audit").insert({
      event_type: AUDIT_EVENT.WITHDRAWAL_FAILED,
      details: { error: error.message, stage: "initiate", userId, amountKobo },
    });
    throw new WithdrawProcessingError(error.message);
  }

  const withdrawalId = data as string;
  await supabase.from("billing_audit").insert({
    event_type: AUDIT_EVENT.WITHDRAWAL_REQUESTED,
    details: { withdrawal_id: withdrawalId, user_id: userId, amount_kobo: amountKobo },
  });
  return { withdrawalId };
}

/**
 * Flip a pending withdrawal to success after Paystack confirms transfer.
 * Debits the wallet in the same DB transaction as the status change.
 */
export async function completeWithdrawal(
  supabase: SupabaseClient,
  input: unknown,
): Promise<{ status: "success" | "duplicate"; newBalanceKobo?: number }> {
  const parsed = completeSchema.safeParse(input);
  if (!parsed.success) {
    throw new WithdrawValidationError(parsed.error.message);
  }
  const { withdrawalId, paystackTransferReference } = parsed.data;

  const { data, error } = await supabase.rpc("complete_withdrawal", {
    p_txn_id: withdrawalId,
    p_transfer_reference: paystackTransferReference,
  });
  if (error) {
    throw new WithdrawProcessingError(error.message);
  }
  const payload = data as {
    status: "success" | "duplicate";
    new_balance_kobo?: number;
  };

  await supabase.from("billing_audit").insert({
    event_type: AUDIT_EVENT.WITHDRAWAL_COMPLETED,
    details: {
      withdrawal_id: withdrawalId,
      transfer_reference: paystackTransferReference,
      status: payload.status,
      new_balance_kobo: payload.new_balance_kobo,
    },
  });

  return {
    status: payload.status,
    newBalanceKobo:
      payload.new_balance_kobo != null
        ? Number(payload.new_balance_kobo)
        : undefined,
  };
}

/**
 * Mark a pending withdrawal as failed. No wallet change — because the
 * balance was never debited, there is nothing to refund.
 */
export async function failWithdrawal(
  supabase: SupabaseClient,
  input: unknown,
): Promise<{ status: "failed" | "duplicate" }> {
  const parsed = failSchema.safeParse(input);
  if (!parsed.success) {
    throw new WithdrawValidationError(parsed.error.message);
  }
  const { withdrawalId, reason } = parsed.data;

  const { data, error } = await supabase.rpc("fail_withdrawal", {
    p_txn_id: withdrawalId,
    p_reason: reason,
  });
  if (error) {
    throw new WithdrawProcessingError(error.message);
  }
  const payload = data as { status: "failed" | "duplicate" };

  await supabase.from("billing_audit").insert({
    event_type: AUDIT_EVENT.WITHDRAWAL_FAILED,
    details: {
      withdrawal_id: withdrawalId,
      reason,
      status: payload.status,
    },
  });
  return payload;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class WithdrawValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WithdrawValidationError";
  }
}

export class WithdrawProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WithdrawProcessingError";
  }
}
