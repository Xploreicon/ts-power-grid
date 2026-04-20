/**
 * Billing engine tunables. All money in integer KOBO (1 NGN = 100 kobo).
 *
 * Changes here flow through to the SQL RPCs via explicit parameters — the
 * TS engine forwards these values on every call so the DB never has a
 * stale default if config is updated at deploy time.
 */

/** Platform fee as a fraction of gross charge. 0.05 = 5%. */
export const PLATFORM_FEE_PERCENT = 0.05;

/** Warn neighbour when wallet dips below this (kobo). */
export const LOW_BALANCE_THRESHOLD_KOBO = 20_000; // ₦200

/**
 * Upper bound on kWh consumed between two consecutive meter readings.
 * Anything higher is flagged as an anomaly rather than charged — protects
 * against meter faults and malformed payloads wiping out a wallet.
 */
export const MAX_REASONABLE_READING_DELTA_KWH = 100;

/** Minimum kobo a host can withdraw in one request. */
export const MIN_WITHDRAWAL_KOBO = 500_000; // ₦5,000

/**
 * 1 kWh reading delta ≈ 1 hour at ~1 kW load. Two readings arriving
 * within the same second with the same cumulative value are treated as
 * duplicates (idempotency is keyed on cumulative_kwh, not timestamp).
 */
export const READING_IDEMPOTENCY_PREFIX = "reading:";

/** Audit event types emitted by the TS engine (DB-side events use their own set). */
export const AUDIT_EVENT = {
  READING_RECEIVED: "reading_received",
  READING_REJECTED: "reading_rejected",
  DISCONNECT_ISSUED: "disconnect_issued",
  RECONNECT_ISSUED: "reconnect_issued",
  LOW_BALANCE_NOTIFIED: "low_balance_notified",
  TOPUP_VERIFIED: "topup_verified",
  TOPUP_REJECTED: "topup_rejected",
  WITHDRAWAL_REQUESTED: "withdrawal_requested",
  WITHDRAWAL_COMPLETED: "withdrawal_completed",
  WITHDRAWAL_FAILED: "withdrawal_failed",
} as const;

export type AuditEvent = (typeof AUDIT_EVENT)[keyof typeof AUDIT_EVENT];
