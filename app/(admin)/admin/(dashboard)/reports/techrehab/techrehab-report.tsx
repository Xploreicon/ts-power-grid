"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { MetricCard } from "@/components/admin/metric-card";
import { ReportViewer } from "@/components/admin/report-viewer";
import { formatNgnKobo } from "@/lib/admin/format";

export function TechrehabReport({
  capitalDeployedKobo,
  capitalRecoveredKobo,
  atRiskKobo,
  monthly,
}: {
  capitalDeployedKobo: number;
  capitalRecoveredKobo: number;
  atRiskKobo: number;
  monthly: { month: string; deployed: number; recovered: number }[];
}) {
  const outstanding = Math.max(capitalDeployedKobo - capitalRecoveredKobo, 0);
  const defaultRate = capitalDeployedKobo
    ? ((atRiskKobo / capitalDeployedKobo) * 100).toFixed(1)
    : "0.0";

  return (
    <ReportViewer
      title="Techrehab investor view"
      description="Capital deployment, recovery, and risk exposure."
      emailEnabled
      csvRows={() => ({
        filename: "techrehab",
        rows: [
          ["month", "deployed_kobo", "recovered_kobo"],
          ...monthly.map((m) => [m.month, m.deployed, m.recovered]),
        ],
      })}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Capital deployed"
          value={formatNgnKobo(capitalDeployedKobo)}
          hint="Cumulative"
        />
        <MetricCard
          label="Capital recovered"
          value={formatNgnKobo(capitalRecoveredKobo)}
          hint="Installments paid"
        />
        <MetricCard
          label="Outstanding"
          value={formatNgnKobo(outstanding)}
          hint="Deployed − recovered"
        />
        <MetricCard
          label="At-risk (overdue)"
          value={formatNgnKobo(atRiskKobo)}
          hint={`${defaultRate}% default rate`}
        />
      </div>

      <div className="mt-6 h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="month" fontSize={11} />
            <YAxis
              fontSize={11}
              tickFormatter={(v) => `₦${Math.round(Number(v) / 100 / 1_000_000)}M`}
            />
            <Tooltip formatter={(v) => formatNgnKobo(Number(v ?? 0))} />
            <Legend />
            <Bar dataKey="deployed" name="Deployed" fill="#051530" />
            <Bar dataKey="recovered" name="Recovered" fill="#FFB800" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <section className="mt-6 rounded-xl border border-dashed border-navy-100 p-4">
        <h3 className="font-display text-lg font-semibold">
          90-day cashflow projection
        </h3>
        <p className="mt-1 text-sm text-navy-700/60">
          Projection engine sits on{" "}
          <code>installments.due_date</code> + expected top-ups. Wire in a
          follow-up with a Supabase RPC.
        </p>
      </section>
    </ReportViewer>
  );
}
