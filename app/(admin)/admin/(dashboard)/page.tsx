import dynamic from "next/dynamic";
import { getDashboardSnapshot } from "@/lib/admin/queries";
import { MetricCard } from "@/components/admin/metric-card";
import { formatNgnKobo } from "@/lib/admin/format";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { AlertsFeed } from "@/components/admin/alerts-feed";
import { HealthMeter } from "@/components/admin/health-meter";

// Leaflet touches window on import, so the map must be client-only.
const MapView = dynamic(
  () => import("@/components/admin/map-view").then((m) => m.MapView),
  { ssr: false, loading: () => <MapSkeleton /> },
);

export const dynamicParams = true;
export const revalidate = 60;

export default async function AdminDashboardPage() {
  const snap = await getDashboardSnapshot();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-navy-700/70">
          Platform overview — last 30 days.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-6">
        <MetricCard label="Total sites" value={snap.totalSites} />
        <MetricCard label="Active hosts" value={snap.activeHosts} />
        <MetricCard label="Active neighbors" value={snap.activeNeighbors} />
        <MetricCard
          label="Today's revenue"
          value={formatNgnKobo(snap.revenueTodayKobo)}
          hint="Platform fees collected"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-navy-100 bg-white p-5 lg:col-span-2">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-lg font-semibold">
              30-day revenue
            </h2>
            <span className="text-xs text-navy-700/60">Platform fees, ₦</span>
          </div>
          <div className="mt-4 h-64">
            <RevenueChart data={snap.revenueByDay} />
          </div>
        </div>
        <div className="rounded-2xl border border-navy-100 bg-white p-5">
          <h2 className="font-display text-lg font-semibold">Platform health</h2>
          <div className="mt-4 space-y-4">
            <HealthMeter
              label="Gateway uptime"
              pct={snap.platformHealth.gatewaysOnlinePct}
            />
            <HealthMeter
              label="Meter reporting"
              pct={snap.platformHealth.meterReportingPct}
            />
            <HealthMeter
              label="Payment success"
              pct={snap.platformHealth.paymentSuccessPct}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-navy-100 bg-white p-5 lg:col-span-2">
          <h2 className="font-display text-lg font-semibold">
            Site map — Lagos
          </h2>
          <div className="mt-4">
            <MapView
              markers={snap.siteMarkers.map((m) => ({
                ...m,
                href: `/admin/sites/${m.id}`,
              }))}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-navy-100 bg-white p-5">
          <h2 className="font-display text-lg font-semibold">Recent alerts</h2>
          <div className="mt-4">
            <AlertsFeed alerts={snap.recentAlerts} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MapSkeleton() {
  return (
    <div className="flex h-[420px] items-center justify-center rounded-2xl border border-navy-100 bg-offwhite text-sm text-navy-700/60">
      Loading map…
    </div>
  );
}
