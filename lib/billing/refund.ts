/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AUDIT_EVENT } from "./config";

/**
 * Refund mechanism for the dispute resolution workflow.
 *
 * processRefund wraps the `process_refund` RPC which atomically:
 *   - Credits the recipient wallet
 *   - Optionally debits the host wallet (source = 'host')
 *   - Creates refund transactions linked to the dispute
 *   - Tags the dispute with refund metadata
 *
 * After refund, if the recipient was disconnected, the meter is reconnected.
 */

export const refundSchema = z.object({
  disputeId: z.string().uuid(),
  amountKobo: z.number().int().positive("Refund amount must be positive"),
  source: z.enum(["host", "treasury"]),
  recipientId: z.string().uuid(),
  hostId: z.string().uuid().optional(),
  connectionId: z.string().uuid().optional(),
});

export type RefundInput = z.infer<typeof refundSchema>;

export interface RefundResult {
  transactionId: string;
  newBalanceKobo: number;
  amountKobo: number;
  reconnected: boolean;
}

export async function processRefund(
  supabase: SupabaseClient,
  input: unknown,
): Promise<RefundResult> {
  const parsed = refundSchema.safeParse(input);
  if (!parsed.success) {
    throw new RefundValidationError(parsed.error.message);
  }

  const { disputeId, amountKobo, source, recipientId, hostId, connectionId } =
    parsed.data;

  // Guard: source='host' requires hostId
  if (source === "host" && !hostId) {
    throw new RefundValidationError(
      "hostId is required when refund source is 'host'",
    );
  }

  // Guard: prevent duplicate refunds on same dispute
  const { data: existing } = await supabase
    .from("disputes")
    .select("refund_amount_kobo")
    .eq("id", disputeId)
    .maybeSingle();

  if (existing?.refund_amount_kobo && Number(existing.refund_amount_kobo) > 0) {
    throw new RefundProcessingError(
      "This dispute already has a refund. Duplicate refund rejected.",
    );
  }

  // Execute atomic refund RPC
  const { data, error } = await supabase.rpc("process_refund", {
    p_dispute_id: disputeId,
    p_amount_kobo: amountKobo,
    p_source: source,
    p_recipient_id: recipientId,
    p_host_id: hostId ?? null,
    p_connection_id: connectionId ?? null,
  });

  if (error) {
    await supabase.from("billing_audit").insert({
      event_type: AUDIT_EVENT.REFUND_FAILED ?? "refund_failed",
      details: { dispute_id: disputeId, error: error.message, amountKobo },
    });
    throw new RefundProcessingError(error.message);
  }

  const result = data as {
    transaction_id: string;
    new_balance_kobo: number;
    amount_kobo: number;
  };

  // Audit log
  await supabase.from("billing_audit").insert({
    event_type: "refund_processed",
    details: {
      dispute_id: disputeId,
      transaction_id: result.transaction_id,
      amount_kobo: amountKobo,
      source,
      recipient_id: recipientId,
      new_balance_kobo: result.new_balance_kobo,
    },
  });

  // If the recipient's meter was disconnected and they now have balance,
  // reconnect the meter automatically.
  let reconnected = false;
  if (connectionId && result.new_balance_kobo > 0) {
    const { data: conn } = await supabase
      .from("connections")
      .select("meter_id, status")
      .eq("id", connectionId)
      .maybeSingle();

    if (conn?.meter_id && conn.status === "suspended") {
      const { issueReconnectCommand } = await import("./disconnect");
      await issueReconnectCommand(supabase, conn.meter_id, "refund", {
        dispute_id: disputeId,
      }).catch(console.error);
      reconnected = true;
    }
  }

  return {
    transactionId: result.transaction_id,
    newBalanceKobo: Number(result.new_balance_kobo),
    amountKobo: Number(result.amount_kobo),
    reconnected,
  };
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class RefundValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RefundValidationError";
  }
}

export class RefundProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RefundProcessingError";
  }
}
