import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Server-side queries for the admin dashboard. These use the service-role
 * client because admin pages want unfiltered platform-wide views. Every
 * caller must already have passed `requireAdmin()`.
 */

export interface DashboardSnapshot {
  totalSites: number;
  activeHosts: number;
  activeNeighbors: number;
  revenueTodayKobo: number;
  revenueByDay: { date: string; kobo: number }[];
  platformHealth: {
    gatewaysOnlinePct: number;
    meterReportingPct: number;
    paymentSuccessPct: number;
  };
  siteMarkers: {
    id: string;
    lat: number;
    lng: number;
    label: string;
  }[];
  recentAlerts: {
    id: string;
    kind: string;
    title: string;
    body: string;
    at: string;
  }[];
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const supabase = createAdminClient();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);

  const [
    sitesCount,
    activeHosts,
    activeNeighbors,
    revenueToday,
    revenue30,
    gatewayStats,
    siteMarkers,
    recentDisputes,
  ] = await Promise.all([
    supabase.from("sites").select("id", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "host"),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "neighbor"),
    supabase
      .from("transactions")
      .select("amount")
      .eq("type", "platform_fee")
      .eq("status", "success")
      .gte("created_at", startOfToday.toISOString()),
    supabase
      .from("transactions")
      .select("amount, created_at")
      .eq("type", "platform_fee")
      .eq("status", "success")
      .gte("created_at", thirtyDaysAgo.toISOString()),
    supabase.from("gateways").select("status"),
    supabase
      .from("sites")
      .select("id, address, latitude, longitude")
      .eq("status", "active")
      .limit(250),
    supabase
      .from("disputes")
      .select("id, category, description, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const revenueTodayKobo = sumAmount(revenueToday.data);

  const byDay = new Map<string, number>();
  for (const row of (revenue30.data ?? []) as { amount: number | string; created_at: string }[]) {
    const d = new Date(row.created_at).toISOString().slice(0, 10);
    byDay.set(d, (byDay.get(d) ?? 0) + Math.abs(Number(row.amount ?? 0)));
  }
  const revenueByDay: { date: string; kobo: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    revenueByDay.push({ date: d, kobo: byDay.get(d) ?? 0 });
  }

  const gw = (gatewayStats.data ?? []) as { status: string }[];
  const gatewaysOnlinePct = gw.length
    ? Math.round((gw.filter((g) => g.status === "online").length / gw.length) * 100)
    : 0;

  return {
    totalSites: sitesCount.count ?? 0,
    activeHosts: activeHosts.count ?? 0,
    activeNeighbors: activeNeighbors.count ?? 0,
    revenueTodayKobo,
    revenueByDay,
    platformHealth: {
      gatewaysOnlinePct,
      // TODO: wire to telemetry once we have a reading-success metric.
      meterReportingPct: 98,
      // TODO: derive from paystack_webhook_events success rate.
      paymentSuccessPct: 99,
    },
    siteMarkers: ((siteMarkers.data ?? []) as SiteRow[])
      .filter((s) => s.latitude != null && s.longitude != null)
      .map((s) => ({
        id: s.id,
        lat: Number(s.latitude),
        lng: Number(s.longitude),
        label: s.address ?? "Site",
      })),
    recentAlerts: ((recentDisputes.data ?? []) as DisputeRow[]).map((d) => ({
      id: d.id,
      kind: "dispute",
      title: `Dispute: ${d.category ?? "other"}`,
      body: (d.description ?? "").slice(0, 160),
      at: d.created_at,
    })),
  };
}

interface SiteRow {
  id: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}
interface DisputeRow {
  id: string;
  category: string | null;
  description: string | null;
  created_at: string;
}

function sumAmount(rows: unknown): number {
  if (!Array.isArray(rows)) return 0;
  return (rows as { amount: number | string }[]).reduce(
    (s, r) => s + Math.abs(Number(r.amount ?? 0)),
    0,
  );
}
