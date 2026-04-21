import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AUDIT_EVENT, LOW_BALANCE_THRESHOLD_KOBO } from "./config";
import { issueReconnectCommand } from "./disconnect";
import { sendReconnectConfirmation } from "@/lib/whatsapp/proactive";

/**
 * Wallet top-ups. Idempotent on Paystack reference — the reference is
 * stored on the transaction row (UNIQUE) so duplicate webhook deliveries
 * or double-submit attempts fall through as no-ops.
 *
 * Paystack verification is stubbed here and completed in Prompt 10.
 * When that lands, `verifyPaystackReference` fetches /transaction/verify
 * and compares amount/currency/status; until then we trust the caller
 * (admin/server) to pass verified inputs.
 */

export const topupSchema = z.object({
  userId: z.string().uuid(),
  amountKobo: z.number().int().positive(),
  paystackReference: z.string().min(3),
});

export type TopupInput = z.infer<typeof topupSchema>;

export interface TopupResult {
  status: "success" | "duplicate";
  transactionId: string;
  newBalanceKobo: number;
  reconnected: boolean;
}

/**
 * Verify with Paystack that `reference` corresponds to a successful
 * charge for `expectedKobo`. STUB — returns true when env flag is set.
 * Replace with a real call in Prompt 10.
 */
export async function verifyPaystackReference(
  reference: string,
  expectedKobo: number,
): Promise<boolean> {
  void reference;
  void expectedKobo;
  if (process.env.PAYSTACK_VERIFY_STUB === "true") return true;
  // TODO(prompt-10): call https://api.paystack.co/transaction/verify/:ref
  return false;
}

/**
 * Credit a wallet from a verified Paystack payment. Writes a
 * `topup_verified` audit row, runs the `process_topup` RPC atomically,
 * and — if the user had a zero balance — issues a reconnect command for
 * every active connection they hold.
 */
export async function processTopup(
  supabase: SupabaseClient,
  input: unknown,
): Promise<TopupResult> {
  const parsed = topupSchema.safeParse(input);
  if (!parsed.success) {
    throw new TopupValidationError(parsed.error.message);
  }
  const topup = parsed.data;

  await supabase.from("billing_audit").insert({
    event_type: AUDIT_EVENT.TOPUP_VERIFIED,
    details: {
      user_id: topup.userId,
      amount_kobo: topup.amountKobo,
      reference: topup.paystackReference,
    },
  });

  const { data, error } = await supabase.rpc("process_topup", {
    p_user_id: topup.userId,
    p_amount_kobo: topup.amountKobo,
    p_reference: topup.paystackReference,
  });

  if (error) {
    await supabase.from("billing_audit").insert({
      event_type: AUDIT_EVENT.TOPUP_REJECTED,
      details: { error: error.message, topup },
    });
    throw new TopupProcessingError(error.message);
  }

  const payload = data as {
    status: "success" | "duplicate";
    transaction_id: string;
    new_balance_kobo: number;
    was_zero?: boolean;
  };

  let reconnected = false;
  if (
    payload.status === "success" &&
    payload.was_zero &&
    payload.new_balance_kobo > LOW_BALANCE_THRESHOLD_KOBO
  ) {
    reconnected = await reconnectAllNeighborMeters(supabase, topup.userId);
    if (reconnected) {
      await sendReconnectConfirmation(supabase, topup.userId, {
        newBalanceKobo: Number(payload.new_balance_kobo),
      }).catch((err) => {
        console.error("[topup] reconnect whatsapp failed:", err);
      });
    }
  }

  return {
    status: payload.status,
    transactionId: payload.transaction_id,
    newBalanceKobo: Number(payload.new_balance_kobo),
    reconnected,
  };
}

async function reconnectAllNeighborMeters(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data: conns } = await supabase
    .from("connections")
    .select("id, meter_id")
    .eq("neighbor_id", userId)
    .eq("status", "active");

  const rows = (conns ?? []) as { id: string; meter_id: string }[];
  if (!rows.length) return false;

  await Promise.all(
    rows.map((c) =>
      issueReconnectCommand(supabase, c.meter_id, "topup_restored_balance", {
        connection_id: c.id,
      }),
    ),
  );
  return true;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class TopupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TopupValidationError";
  }
}

export class TopupProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TopupProcessingError";
  }
}
