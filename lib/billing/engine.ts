import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PLATFORM_FEE_PERCENT,
  LOW_BALANCE_THRESHOLD_KOBO,
  MAX_REASONABLE_READING_DELTA_KWH,
  AUDIT_EVENT,
} from "./config";
import { issueDisconnectCommand } from "./disconnect";
import {
  sendDisconnectNotification,
  sendLowBalanceWarning,
} from "@/lib/messaging";

/**
 * Billing engine — single public entry point `processReading()` wraps the
 * atomic PL/pgSQL function `process_meter_reading`. The RPC performs all
 * writes inside one transaction (debit, credit, ledger, telemetry, audit)
 * so partial state is impossible. This TS layer:
 *   1. Validates the payload (Zod).
 *   2. Forwards it to the RPC with config-driven parameters.
 *   3. Dispatches side-effects based on the returned action
 *      (disconnect command, low-balance notification).
 *
 * All amounts are integer KOBO; kWh may carry up to 3 decimals.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const readingSchema = z.object({
  meterId: z.string().uuid(),
  cumulativeKwh: z.number().finite().nonnegative(),
  timestamp: z.string().datetime(),
});

export type ReadingInput = z.infer<typeof readingSchema>;

export type ReadingStatus =
  | "first_reading"
  | "host_meter"
  | "flat_reading"
  | "processed"
  | "duplicate"
  | "anomaly_negative"
  | "anomaly_excessive"
  | "no_active_connection"
  | "insufficient_funds";

export type ReadingAction = "none" | "low_balance" | "disconnect";

export interface ReadingResult {
  status: ReadingStatus;
  action: ReadingAction;
  deltaKwh?: number;
  amountKobo?: number;
  chargedKobo?: number;
  feeKobo?: number;
  hostEarnKobo?: number;
  newBalanceKobo?: number;
  connectionId?: string;
  transactionId?: string;
}

// The raw jsonb payload returned by `process_meter_reading`.
interface RpcPayload {
  status: ReadingStatus;
  action: ReadingAction;
  delta_kwh?: number;
  amount_kobo?: number;
  charged_kobo?: number;
  fee_kobo?: number;
  host_earn_kobo?: number;
  new_balance_kobo?: number;
  connection_id?: string;
  transaction_id?: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Process a meter reading end-to-end. Idempotent on
 * (meter_id, cumulative_kwh): re-submitting the same reading returns
 * `{ status: "duplicate" }` without side-effects.
 *
 * @param supabase — a service-role Supabase client (bypasses RLS).
 * @param input    — the reading payload. Unvalidated input is parsed by Zod.
 */
export async function processReading(
  supabase: SupabaseClient,
  input: unknown,
): Promise<ReadingResult> {
  const parsed = readingSchema.safeParse(input);
  if (!parsed.success) {
    throw new ReadingValidationError(parsed.error.message);
  }
  const reading = parsed.data;

  await supabase.from("billing_audit").insert({
    event_type: AUDIT_EVENT.READING_RECEIVED,
    meter_id: reading.meterId,
    details: {
      cumulative_kwh: reading.cumulativeKwh,
      timestamp: reading.timestamp,
    },
  });

  const { data, error } = await supabase.rpc("process_meter_reading", {
    p_meter_id: reading.meterId,
    p_cumulative_kwh: reading.cumulativeKwh,
    p_timestamp: reading.timestamp,
    p_fee_rate: PLATFORM_FEE_PERCENT,
    p_max_delta_kwh: MAX_REASONABLE_READING_DELTA_KWH,
    p_low_balance_threshold_kobo: LOW_BALANCE_THRESHOLD_KOBO,
  });

  if (error) {
    await supabase.from("billing_audit").insert({
      event_type: AUDIT_EVENT.READING_REJECTED,
      meter_id: reading.meterId,
      details: { error: error.message, reading },
    });
    throw new ReadingProcessingError(error.message);
  }

  const payload = data as RpcPayload;
  const result: ReadingResult = {
    status: payload.status,
    action: payload.action,
    deltaKwh: payload.delta_kwh,
    amountKobo: payload.amount_kobo,
    chargedKobo: payload.charged_kobo,
    feeKobo: payload.fee_kobo,
    hostEarnKobo: payload.host_earn_kobo,
    newBalanceKobo: payload.new_balance_kobo,
    connectionId: payload.connection_id,
    transactionId: payload.transaction_id,
  };

  // Dispatch post-charge side-effects. These run AFTER the DB transaction
  // has committed — if they fail, the ledger is still correct and an
  // admin retry path can re-issue disconnects from the audit log.
  if (result.action === "disconnect") {
    await issueDisconnectCommand(supabase, reading.meterId, "zero_balance", {
      new_balance_kobo: result.newBalanceKobo,
      connection_id: result.connectionId,
    });
    await notifyDisconnectViaWhatsApp(supabase, result).catch((err) => {
      console.error("[billing] disconnect whatsapp notify failed:", err);
    });
  } else if (result.action === "low_balance") {
    await notifyLowBalance(supabase, reading.meterId, result);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Side-effects
// ---------------------------------------------------------------------------

async function notifyLowBalance(
  supabase: SupabaseClient,
  meterId: string,
  result: ReadingResult,
): Promise<void> {
  // Find the neighbour behind this connection so we can notify them.
  if (!result.connectionId) return;
  const { data: conn } = await supabase
    .from("connections")
    .select("neighbor_id")
    .eq("id", result.connectionId)
    .maybeSingle();
  if (!conn?.neighbor_id) return;

  const naira = ((result.newBalanceKobo ?? 0) / 100).toFixed(2);
  await supabase.from("notifications").insert({
    user_id: conn.neighbor_id,
    type: "low_balance",
    title: "Low wallet balance",
    body: `Your balance is ₦${naira}. Top up now to avoid disconnection.`,
    data: {
      balance_kobo: result.newBalanceKobo,
      connection_id: result.connectionId,
    },
  });

  await supabase.from("billing_audit").insert({
    event_type: AUDIT_EVENT.LOW_BALANCE_NOTIFIED,
    meter_id: meterId,
    connection_id: result.connectionId,
    details: { balance_kobo: result.newBalanceKobo },
  });

  // Parallel WhatsApp warning — non-blocking.
  await sendLowBalanceWarning(supabase, conn.neighbor_id, {
    balanceKobo: result.newBalanceKobo ?? 0,
  }).catch((err) => {
    console.error("[billing] low-balance whatsapp failed:", err);
  });
}

async function notifyDisconnectViaWhatsApp(
  supabase: SupabaseClient,
  result: ReadingResult,
): Promise<void> {
  if (!result.connectionId) return;
  const { data: conn } = await supabase
    .from("connections")
    .select("neighbor_id")
    .eq("id", result.connectionId)
    .maybeSingle();
  if (!conn?.neighbor_id) return;
  await sendDisconnectNotification(supabase, conn.neighbor_id);
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ReadingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReadingValidationError";
  }
}

export class ReadingProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReadingProcessingError";
  }
}
