/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AUDIT_EVENT } from "./config";
import { dispatchNotification } from "@/lib/notifications/dispatcher";
import { publishRelay } from "@/lib/mqtt/publisher";

/**
 * Relay command dispatch — open the meter's contactor on disconnect,
 * close it on reconnect. The actual MQTT publish goes through
 * `lib/mqtt/publisher.publishRelay`, which writes to
 * `ts/sites/{site_id}/commands/relay` on the shared backend mqtt
 * connection. The gateway firmware listens on that topic and
 * actuates the relay (or simulates the actuation when running with
 * the simulator driver).
 *
 * `acknowledged` reports whether the broker PUBACK'd the message —
 * that's a guarantee the broker received it, not that the gateway
 * has applied the relay change yet. The gateway publishes a
 * follow-up `command_ack` event on its events topic; the ingest
 * service records that asynchronously.
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
  const acknowledged = await publishRelayForMeter(supabase, meterId, "open");

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
  const acknowledged = await publishRelayForMeter(supabase, meterId, "close");

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

/**
 * Resolve `meter_id` → `site_id` (via the meter's gateway) and publish
 * the relay command. Returns true on broker PUBACK, false on lookup
 * miss or publish failure — the caller still writes the audit row so
 * an operator can see "command attempted but broker rejected" cases.
 */
async function publishRelayForMeter(
  supabase: SupabaseClient,
  meterId: string,
  action: "open" | "close",
): Promise<boolean> {
  const { data, error } = await supabase
    .from("meters")
    .select("gateways:gateway_id(site_id)")
    .eq("id", meterId)
    .maybeSingle();
  if (error || !data) {
    console.error(
      `[billing] publishRelay lookup failed for meter ${meterId}:`,
      error?.message ?? "no row",
    );
    return false;
  }
  // Supabase typings flatten this oddly; the join may surface as an
  // object or a single-element array depending on PostgREST mood.
  const gw = (data as any).gateways;
  const siteId = (Array.isArray(gw) ? gw[0]?.site_id : gw?.site_id) as
    | string
    | undefined;
  if (!siteId) {
    console.error(
      `[billing] meter ${meterId} has no gateway/site — cannot publish relay`,
    );
    return false;
  }
  try {
    await publishRelay(siteId, meterId, action);
    return true;
  } catch (err) {
    console.error(
      `[billing] publishRelay failed for meter ${meterId} (${action}):`,
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}
