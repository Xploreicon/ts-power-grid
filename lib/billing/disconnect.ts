/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AUDIT_EVENT } from "./config";
import { dispatchNotification } from "@/lib/notifications/dispatcher";

/**
 * MQTT command dispatch is implemented in Prompt 15. Until then these
 * helpers only log to `billing_audit` so the ledger records intent, and
 * update `meters.status` so the UI reflects the connection state.
 *
 * When the MQTT client lands, replace the TODO blocks with `publish()`
 * calls — the surface here will not change.
 */

export interface DisconnectResult {
  meterId: string;
  issuedAt: string;
  /** True once the MQTT broker ACKs the command. Stubbed `true` for now. */
  acknowledged: boolean;
}

/**
 * Publish a DISCONNECT command to the gateway for this meter. Marks the
 * meter as `disconnected` and writes an audit row. Safe to call
 * repeatedly — the audit row is append-only and meter.status is
 * idempotently set.
 */
export async function issueDisconnectCommand(
  supabase: SupabaseClient,
  meterId: string,
  reason: string,
  extra: Record<string, unknown> = {},
): Promise<DisconnectResult> {
  const issuedAt = new Date().toISOString();

  // TODO(prompt-15): publish to `gateways/<gw>/meters/<meter>/cmd/disconnect`.
  const acknowledged = true;

  await supabase
    .from("meters")
    .update({ status: "disconnected" })
    .eq("id", meterId);

  await supabase.from("billing_audit").insert({
    event_type: AUDIT_EVENT.DISCONNECT_ISSUED,
    meter_id: meterId,
    details: { reason, issued_at: issuedAt, acknowledged, ...extra },
  });

  // Wire up notification
  const { data: conn } = await supabase
    .from("connections")
    .select("neighbor_id, host_id, profiles!neighbor_id(full_name)")
    .eq("meter_id", meterId)
    .single();

  if (conn) {
    // 1. To neighbor
    await dispatchNotification(conn.neighbor_id, "disconnect_notification", {}).catch(console.error);
    
    // 2. To host
    await dispatchNotification(conn.host_id, "neighbor_disconnected", {
      neighborName: (conn.profiles as any)?.full_name || "A neighbor",
    }).catch(console.error);
  }

  return { meterId, issuedAt, acknowledged };
}

/**
 * Publish a RECONNECT command. Used after a successful topup that brings
 * a previously zero-balance wallet above the low-balance threshold.
 */
export async function issueReconnectCommand(
  supabase: SupabaseClient,
  meterId: string,
  reason: string,
  extra: Record<string, unknown> = {},
): Promise<DisconnectResult> {
  const issuedAt = new Date().toISOString();

  // TODO(prompt-15): publish to `gateways/<gw>/meters/<meter>/cmd/reconnect`.
  const acknowledged = true;

  await supabase
    .from("meters")
    .update({ status: "active" })
    .eq("id", meterId);

  await supabase.from("billing_audit").insert({
    event_type: AUDIT_EVENT.RECONNECT_ISSUED,
    meter_id: meterId,
    details: { reason, issued_at: issuedAt, acknowledged, ...extra },
  });

  // Wire up notification
  const { data: conn } = await supabase
    .from("connections")
    .select("neighbor_id")
    .eq("meter_id", meterId)
    .single();

  if (conn?.neighbor_id) {
    await dispatchNotification(conn.neighbor_id, "reconnect_confirmation", {}).catch(console.error);
  }

  return { meterId, issuedAt, acknowledged };
}
