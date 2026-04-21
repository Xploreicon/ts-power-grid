import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The resolved context for a neighbor message. Most commands require at
 * least `profile` + `wallet`. Missing `connection` is normal when a host
 * has added a phone but not yet wired a meter.
 */
export interface NeighborContext {
  senderPhone: string; // E.164
  profile: {
    id: string;
    full_name: string | null;
    notification_prefs: NotificationPrefs;
  } | null;
  wallet: { id: string; balance_kobo: number } | null;
  connection: {
    id: string;
    host_id: string;
    host_name: string | null;
    current_price_per_kwh: number;
  } | null;
}

export interface NotificationPrefs {
  whatsapp_opt_in?: boolean;
  daily_summary_opt_in?: boolean;
  auto_reconnect?: boolean;
  welcomed_at?: string;
  [k: string]: unknown;
}

export async function loadContext(
  supabase: SupabaseClient,
  phone: string,
): Promise<NeighborContext> {
  const { data, error } = await supabase
    .rpc("whatsapp_resolve_neighbor", { p_phone: phone })
    .maybeSingle();
  if (error || !data) {
    return {
      senderPhone: phone,
      profile: null,
      wallet: null,
      connection: null,
    };
  }
  const row = data as {
    user_id: string;
    full_name: string | null;
    wallet_id: string | null;
    balance_kobo: string | number | null;
    connection_id: string | null;
    host_id: string | null;
    host_name: string | null;
    current_price_per_kwh: string | number | null;
    notification_prefs: NotificationPrefs | null;
  };
  return {
    senderPhone: phone,
    profile: {
      id: row.user_id,
      full_name: row.full_name,
      notification_prefs: row.notification_prefs ?? {},
    },
    wallet: row.wallet_id
      ? { id: row.wallet_id, balance_kobo: Number(row.balance_kobo ?? 0) }
      : null,
    connection:
      row.connection_id && row.host_id
        ? {
            id: row.connection_id,
            host_id: row.host_id,
            host_name: row.host_name,
            current_price_per_kwh: Number(row.current_price_per_kwh ?? 0),
          }
        : null,
  };
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatNgn(kobo: number): string {
  const ngn = kobo / 100;
  return `₦${ngn.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
}

export function formatKwh(kwh: number): string {
  return `${kwh.toLocaleString("en-NG", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })} kWh`;
}
