/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Captures a full context snapshot at the time a dispute is raised.
 * This data is stored in disputes.context so admins can investigate
 * the exact state of the connection without it changing after the fact.
 */
export interface DisputeContext {
  capturedAt: string;
  connection: {
    id: string;
    status: string;
    currentPricePerKwh: number;
    startedAt: string;
    hostId: string;
    neighborId: string;
    meterId: string;
  } | null;
  meterStatus: string | null;
  walletBalance: number | null;
  recentTransactions: Array<{
    id: string;
    type: string;
    amount: number;
    status: string;
    createdAt: string;
    metadata: any;
  }>;
  recentReadings: Array<{
    cumulativeKwh: number;
    recordedAt: string;
  }>;
  recentPriceChanges: Array<{
    oldPrice: number;
    newPrice: number;
    changedAt: string;
  }>;
  gateway: {
    status: string;
    lastSeenAt: string | null;
  } | null;
  site: {
    id: string;
    address: string;
    status: string;
  } | null;
  priorDisputes: number;
}

export async function captureDisputeContext(
  supabase: SupabaseClient,
  connectionId: string,
): Promise<DisputeContext> {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  // 1. Connection details
  const { data: conn } = await supabase
    .from("connections")
    .select("id, status, current_price_per_kwh, started_at, host_id, neighbor_id, meter_id")
    .eq("id", connectionId)
    .maybeSingle();

  // 2. Wallet balance for the neighbor
  let walletBalance: number | null = null;
  if (conn?.neighbor_id) {
    const { data: wallet } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", conn.neighbor_id)
      .maybeSingle();
    walletBalance = wallet ? Number(wallet.balance) : null;
  }

  // 3. Recent transactions (last 24h on this connection)
  const { data: txns } = await supabase
    .from("transactions")
    .select("id, type, amount, status, created_at, metadata")
    .eq("connection_id", connectionId)
    .gte("created_at", twentyFourHoursAgo)
    .order("created_at", { ascending: false })
    .limit(50);

  // 4. Recent meter readings (last 24h)
  let recentReadings: DisputeContext["recentReadings"] = [];
  if (conn?.meter_id) {
    const { data: readings } = await supabase
      .from("telemetry")
      .select("cumulative_kwh, recorded_at")
      .eq("meter_id", conn.meter_id)
      .gte("recorded_at", twentyFourHoursAgo)
      .order("recorded_at", { ascending: true })
      .limit(100);
    recentReadings = (readings ?? []).map((r: any) => ({
      cumulativeKwh: Number(r.cumulative_kwh),
      recordedAt: r.recorded_at,
    }));
  }

  // 5. Gateway status
  let gateway: DisputeContext["gateway"] = null;
  if (conn?.meter_id) {
    const { data: meter } = await supabase
      .from("meters")
      .select("gateway_id")
      .eq("id", conn.meter_id)
      .maybeSingle();
    if (meter?.gateway_id) {
      const { data: gw } = await supabase
        .from("gateways")
        .select("status, last_seen_at")
        .eq("id", meter.gateway_id)
        .maybeSingle();
      if (gw) {
        gateway = { status: gw.status, lastSeenAt: gw.last_seen_at };
      }
    }
  }

  // 6. Site info
  let site: DisputeContext["site"] = null;
  if (conn?.meter_id) {
    const { data: meter } = await supabase
      .from("meters")
      .select("sites(id, address, status)")
      .eq("id", conn.meter_id)
      .maybeSingle();
    const s = (meter as any)?.sites;
    if (s) {
      site = { id: s.id, address: s.address, status: s.status };
    }
  }

  // 7. Price change history (from billing_audit)
  const { data: priceAudits } = await supabase
    .from("billing_audit")
    .select("details, created_at")
    .eq("event_type", "price_changed")
    .gte("created_at", twentyFourHoursAgo)
    .order("created_at", { ascending: false })
    .limit(10);

  const recentPriceChanges = (priceAudits ?? [])
    .filter((a: any) => (a.details as any)?.connection_id === connectionId)
    .map((a: any) => ({
      oldPrice: Number((a.details as any)?.old_price ?? 0),
      newPrice: Number((a.details as any)?.new_price ?? 0),
      changedAt: a.created_at,
    }));

  // 8. Count prior disputes on same connection
  const { count: priorDisputes } = await supabase
    .from("disputes")
    .select("id", { count: "exact", head: true })
    .eq("connection_id", connectionId);

  return {
    capturedAt: now.toISOString(),
    connection: conn
      ? {
          id: conn.id,
          status: conn.status,
          currentPricePerKwh: Number(conn.current_price_per_kwh),
          startedAt: conn.started_at,
          hostId: conn.host_id,
          neighborId: conn.neighbor_id,
          meterId: conn.meter_id,
        }
      : null,
    meterStatus: null, // populated below
    walletBalance,
    recentTransactions: (txns ?? []).map((t: any) => ({
      id: t.id,
      type: t.type,
      amount: Number(t.amount),
      status: t.status,
      createdAt: t.created_at,
      metadata: t.metadata,
    })),
    recentReadings,
    recentPriceChanges,
    gateway,
    site,
    priorDisputes: priorDisputes ?? 0,
  };
}
