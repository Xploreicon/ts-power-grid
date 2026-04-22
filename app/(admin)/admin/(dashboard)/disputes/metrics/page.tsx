/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { formatNgnKobo } from "@/lib/admin/format";
import { StatusBadge } from "@/components/admin/status-badge";

export const dynamic = "force-dynamic";

export default async function DisputeMetricsPage() {
  await requireAdmin();
  const supabase = createAdminClient();

  // Open disputes count
  const { count: openCount } = await supabase
    .from("disputes")
    .select("id", { count: "exact", head: true })
    .in("status", ["open", "investigating", "escalated", "awaiting_info"]);

  // Total disputes
  const { count: totalCount } = await supabase
    .from("disputes")
    .select("id", { count: "exact", head: true });

  // Resolved disputes
  const { count: resolvedCount } = await supabase
    .from("disputes")
    .select("id", { count: "exact", head: true })
    .eq("status", "resolved");

  // Rejected disputes
  const { count: rejectedCount } = await supabase
    .from("disputes")
    .select("id", { count: "exact", head: true })
    .eq("status", "rejected");

  // Resolution rate by category
  const { data: allDisputes } = await supabase
    .from("disputes")
    .select("category, status, created_at, resolved_at");

  const categoryCounts: Record<
    string,
    { total: number; resolved: number; avgHours: number[] }
  > = {};
  for (const d of allDisputes ?? []) {
    const cat = (d.category as string) ?? "other";
    if (!categoryCounts[cat]) {
      categoryCounts[cat] = { total: 0, resolved: 0, avgHours: [] };
    }
    categoryCounts[cat].total += 1;
    if (d.status === "resolved") {
      categoryCounts[cat].resolved += 1;
      if (d.resolved_at) {
        const hours =
          (new Date(d.resolved_at as string).getTime() -
            new Date(d.created_at as string).getTime()) /
          (1000 * 60 * 60);
        categoryCounts[cat].avgHours.push(hours);
      }
    }
  }

  // Top 10 problem hosts (most disputes raised against their connections)
  const { data: hostDisputes } = await supabase
    .from("disputes")
    .select("connection_id, connections(host_id, profiles:host_id(full_name))")
    .order("created_at", { ascending: false })
    .limit(200);

  const hostCounts: Record<string, { name: string; count: number }> = {};
  for (const d of hostDisputes ?? []) {
    const conn = d.connections as any;
    if (conn?.host_id) {
      const hid = conn.host_id;
      if (!hostCounts[hid]) {
        hostCounts[hid] = {
          name: conn.profiles?.full_name ?? hid.slice(0, 8),
          count: 0,
        };
      }
      hostCounts[hid].count += 1;
    }
  }
  const topHosts = Object.entries(hostCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);

  // Top 10 problem neighbors (most disputes raised by them)
  const { data: neighborDisputes } = await supabase
    .from("disputes")
    .select("raised_by, profiles:raised_by(full_name, role)")
    .order("created_at", { ascending: false })
    .limit(200);

  const neighborCounts: Record<string, { name: string; count: number }> = {};
  for (const d of neighborDisputes ?? []) {
    const uid = d.raised_by as string;
    const profile = d.profiles as any;
    if (!neighborCounts[uid]) {
      neighborCounts[uid] = {
        name: profile?.full_name ?? uid.slice(0, 8),
        count: 0,
      };
    }
    neighborCounts[uid].count += 1;
  }
  const topNeighbors = Object.entries(neighborCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);

  // SLA breached count (open > 24h)
  const twentyFourHoursAgo = new Date(
    Date.now() - 24 * 60 * 60 * 1000,
  ).toISOString();
  const { count: slaBreachedCount } = await supabase
    .from("disputes")
    .select("id", { count: "exact", head: true })
    .in("status", ["open", "investigating", "escalated", "awaiting_info"])
    .lt("created_at", twentyFourHoursAgo);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-navy-700/60">
          Disputes
        </p>
        <h1 className="font-display text-2xl font-bold text-navy-950">
          Dispute Metrics
        </h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <MetricCard label="Open" value={openCount ?? 0} color="text-yellow-600" />
        <MetricCard label="Total" value={totalCount ?? 0} color="text-navy-950" />
        <MetricCard
          label="Resolved"
          value={resolvedCount ?? 0}
          color="text-green-600"
        />
        <MetricCard
          label="Rejected"
          value={rejectedCount ?? 0}
          color="text-red-600"
        />
        <MetricCard
          label="SLA Breached"
          value={slaBreachedCount ?? 0}
          color="text-red-600"
        />
      </div>

      {/* Resolution by category */}
      <div className="rounded-2xl border border-navy-100 bg-white p-5">
        <h2 className="font-display text-lg font-semibold mb-4">
          Resolution by Category
        </h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-navy-100 text-xs uppercase tracking-widest text-navy-700/60">
              <th className="py-2 pr-3">Category</th>
              <th className="py-2 pr-3 text-right">Total</th>
              <th className="py-2 pr-3 text-right">Resolved</th>
              <th className="py-2 pr-3 text-right">Rate</th>
              <th className="py-2 text-right">Avg Resolution (hrs)</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(categoryCounts).map(([cat, data]) => {
              const rate =
                data.total > 0
                  ? ((data.resolved / data.total) * 100).toFixed(0)
                  : "—";
              const avgH =
                data.avgHours.length > 0
                  ? (
                      data.avgHours.reduce((a, b) => a + b, 0) /
                      data.avgHours.length
                    ).toFixed(1)
                  : "—";
              return (
                <tr key={cat} className="border-t border-navy-100">
                  <td className="py-2 capitalize font-medium">
                    {cat.replace(/_/g, " ")}
                  </td>
                  <td className="py-2 text-right font-mono">{data.total}</td>
                  <td className="py-2 text-right font-mono">{data.resolved}</td>
                  <td className="py-2 text-right font-mono">{rate}%</td>
                  <td className="py-2 text-right font-mono">{avgH}h</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Top problem hosts & neighbors */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-navy-100 bg-white p-5">
          <h2 className="font-display text-lg font-semibold mb-3">
            Top Problem Hosts
          </h2>
          {topHosts.length === 0 ? (
            <p className="text-sm text-navy-700/60">No data yet.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {topHosts.map(([id, { name, count }], i) => (
                <li
                  key={id}
                  className="flex items-center justify-between border-t border-navy-100 pt-2"
                >
                  <span>
                    <span className="font-mono text-xs text-navy-400 mr-2">
                      {i + 1}.
                    </span>
                    {name}
                  </span>
                  <span className="font-mono font-semibold">{count}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="rounded-2xl border border-navy-100 bg-white p-5">
          <h2 className="font-display text-lg font-semibold mb-3">
            Top Reporters (Neighbors)
          </h2>
          {topNeighbors.length === 0 ? (
            <p className="text-sm text-navy-700/60">No data yet.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {topNeighbors.map(([id, { name, count }], i) => (
                <li
                  key={id}
                  className="flex items-center justify-between border-t border-navy-100 pt-2"
                >
                  <span>
                    <span className="font-mono text-xs text-navy-400 mr-2">
                      {i + 1}.
                    </span>
                    {name}
                  </span>
                  <span className="font-mono font-semibold">{count}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-navy-100 bg-white p-4">
      <p className="text-xs uppercase tracking-widest text-navy-700/60 mb-1">
        {label}
      </p>
      <p className={`font-mono text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
