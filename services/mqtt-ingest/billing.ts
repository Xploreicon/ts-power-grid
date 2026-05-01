/**
 * Self-contained billing-engine adapter for the MQTT ingest service.
 *
 * Why this lives here and not under `lib/billing/` upstream:
 *   The ingest runs as a standalone Node process (Railway / Fly), not
 *   inside the Next.js app. Importing the full `lib/billing/engine`
 *   pulls in the WhatsApp + Telegram + notifications stack — none of
 *   which the ingest needs and most of which won't load outside Next
 *   (server-only guards, absolute path aliases, framework hooks).
 *
 *   The actual ledger work happens server-side inside the
 *   `process_meter_reading` PL/pgSQL function, which writes the
 *   transaction, debit, ledger, telemetry, and audit rows in one
 *   atomic block. All the TS layer does is forward the call. That's
 *   the part we duplicate here.
 *
 * Trade-off: side-effects that the in-app engine dispatches *after*
 * the RPC commits (auto-disconnect command, low-balance WhatsApp,
 * disconnect notification) are NOT fired from the ingest path. The
 * ledger is still correct, the meter just doesn't auto-cut here. If
 * we want auto-disconnect from this service, the cleanest follow-up
 * is to publish the disconnect command to the broker we already
 * have an mqtt client for — the ingest is the right place to do it.
 *
 * Tunables stay in sync with the canonical config by being identical
 * literal values; if these drift from `lib/billing/config.ts` the
 * RPC will silently apply different fee / threshold / cap values
 * depending on which entry point fired. Keep them in lockstep — the
 * comment header on `lib/billing/config.ts` already calls this out.
 */
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Tunables — kept in lockstep with `lib/billing/config.ts`
// ---------------------------------------------------------------------------
const PLATFORM_FEE_PERCENT = 0.05;
const LOW_BALANCE_THRESHOLD_KOBO = 20_000; // ₦200
const MAX_REASONABLE_READING_DELTA_KWH = 100;

const AUDIT_EVENT = {
  READING_RECEIVED: "reading_received",
  READING_REJECTED: "reading_rejected",
} as const;

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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
/**
 * Validate the payload, write a `reading_received` audit row, and
 * forward to `process_meter_reading`. Returns the SQL function's
 * verdict — the caller chooses whether to do anything with it (the
 * ingest currently logs metrics and moves on).
 *
 * Idempotent on `(meter_id, cumulative_kwh)`: re-submitting the same
 * reading returns `{ status: "duplicate" }` without side-effects.
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
  return {
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
}
