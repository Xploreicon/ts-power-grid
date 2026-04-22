import { createAdminClient } from "@/lib/supabase/admin";
import { SitesTable } from "./sites-table";

export const dynamic = "force-dynamic";

export default async function SitesPage() {
  const supabase = createAdminClient();

  // Fetch sites joined to host name. Active-neighbor counts + revenue are
  // aggregated client-side from a second query so the table stays snappy.
  const { data: sites } = await supabase
    .from("sites")
    .select(
      "id, host_id, address, installation_type, status, installed_at, profiles:host_id(full_name)",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const siteIds = (sites ?? []).map((s) => s.id);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // Revenue per site this month = sum of platform fees linked via connection → site.
  const [{ data: connections }, { data: feeRows }] = await Promise.all([
    supabase
      .from("connections")
      .select("id, site_id, status, neighbor_id")
      .in("site_id", siteIds.length ? siteIds : ["__none__"]),
    supabase
      .from("transactions")
      .select("connection_id, amount")
      .eq("type", "platform_fee")
      .eq("status", "success")
      .gte("created_at", startOfMonth.toISOString()),
  ]);

  const connBySite = new Map<string, Array<{ id: string; status: string }>>();
  for (const c of connections ?? []) {
    const list = connBySite.get(c.site_id as string) ?? [];
    list.push({ id: c.id as string, status: c.status as string });
    connBySite.set(c.site_id as string, list);
  }
  const revenueByConn = new Map<string, number>();
  for (const t of feeRows ?? []) {
    const cid = t.connection_id as string | null;
    if (!cid) continue;
    revenueByConn.set(
      cid,
      (revenueByConn.get(cid) ?? 0) + Math.abs(Number(t.amount ?? 0)),
    );
  }

  const rows: SiteRow[] = (sites ?? []).map((s) => {
    const conns = connBySite.get(s.id as string) ?? [];
    const active = conns.filter((c) => c.status === "active").length;
    const revenue = conns.reduce(
      (sum, c) => sum + (revenueByConn.get(c.id) ?? 0),
      0,
    );
    const host =
      ((s.profiles as unknown) as { full_name: string | null } | null)
        ?.full_name ?? null;
    return {
      id: s.id as string,
      host_name: host,
      address: (s.address as string | null) ?? null,
      installation_type: (s.installation_type as string | null) ?? null,
      status: (s.status as string | null) ?? null,
      installed_at: (s.installed_at as string | null) ?? null,
      active_neighbors: active,
      revenue_month_kobo: revenue,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Sites</h1>
        <p className="text-sm text-navy-700/70">
          Every solar host location on the platform.
        </p>
      </div>
      <SitesTable rows={rows} />
    </div>
  );
}

export interface SiteRow {
  id: string;
  host_name: string | null;
  address: string | null;
  installation_type: string | null;
  status: string | null;
  installed_at: string | null;
  active_neighbors: number;
  revenue_month_kobo: number;
}
