import { createAdminClient } from "@/lib/supabase/admin";
import { SitesTable } from "./sites-table";
import { CreateSiteButton, type HostOption } from "./create-site-button";

export const dynamic = "force-dynamic";

export default async function SitesPage() {
  const supabase = createAdminClient();

  // Fetch sites + the host roster in parallel — the latter feeds the
  // Create Site dialog's host picker. Hosts are bounded (~hundreds in
  // pilot, low thousands later) so a flat select is cheap; we'll
  // graduate to a typeahead endpoint when this gets slow.
  const [
    { data: sites },
    { data: hostsRaw },
  ] = await Promise.all([
    supabase
      .from("sites")
      .select(
        "id, name, host_id, address, installation_type, status, installed_at, profiles:host_id(full_name)",
      )
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("profiles")
      .select("id, full_name, phone")
      .in("role", ["host", "admin", "super_admin"])
      .order("full_name", { ascending: true })
      .limit(500),
  ]);

  const hosts: HostOption[] = (hostsRaw ?? []).map((p) => ({
    id: p.id as string,
    full_name: (p.full_name as string | null) ?? null,
    phone: (p.phone as string | null) ?? null,
  }));

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
      name: (s.name as string | null) ?? null,
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Sites</h1>
          <p className="text-sm text-navy-700/70">
            Every solar host location on the platform.
          </p>
        </div>
        <CreateSiteButton hosts={hosts} />
      </div>
      <SitesTable rows={rows} />
    </div>
  );
}

export interface SiteRow {
  id: string;
  name: string | null;
  host_name: string | null;
  address: string | null;
  installation_type: string | null;
  status: string | null;
  installed_at: string | null;
  active_neighbors: number;
  revenue_month_kobo: number;
}
