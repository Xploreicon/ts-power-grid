import Link from "next/link";
import {
  FileBarChart,
  TrendingUp,
  AlertTriangle,
  Activity,
  UserMinus,
  Wallet,
  LineChart,
  Zap,
} from "lucide-react";

const REPORTS = [
  {
    slug: "revenue-monthly",
    title: "Monthly revenue breakdown",
    body: "Gross revenue, platform fees, host earnings — last 12 months.",
    icon: TrendingUp,
  },
  {
    slug: "installment-collection",
    title: "Installment collection",
    body: "Performance vs schedule for Path A installation financing.",
    icon: Wallet,
  },
  {
    slug: "default-rate",
    title: "Default rate",
    body: "Installments overdue > 30 days ÷ active installments.",
    icon: AlertTriangle,
  },
  {
    slug: "gateway-uptime",
    title: "Gateway uptime by site",
    body: "% of 5-minute windows with a reading, last 30 days.",
    icon: Activity,
  },
  {
    slug: "meter-accuracy",
    title: "Meter accuracy",
    body: "Reconciliation of reported kWh vs expected generation.",
    icon: Zap,
  },
  {
    slug: "neighbor-churn",
    title: "Neighbor churn rate",
    body: "% of active neighbors disconnected in each 30-day window.",
    icon: UserMinus,
  },
  {
    slug: "host-earnings",
    title: "Host earnings distribution",
    body: "Median / P90 monthly payout per host.",
    icon: LineChart,
  },
  {
    slug: "platform-fee-trend",
    title: "Platform fee revenue trend",
    body: "Daily platform-fee collection, rolling 90 days.",
    icon: FileBarChart,
  },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-navy-700/70">
          Pre-built reports. Each supports date-range filters, PDF + CSV
          export, and scheduled email delivery.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          return (
            <Link
              key={r.slug}
              href={`/admin/reports/${r.slug}`}
              className="group rounded-2xl border border-navy-100 bg-white p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-yellow-500/10 text-navy-950">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold group-hover:text-navy-950">
                    {r.title}
                  </h3>
                  <p className="mt-1 text-sm text-navy-700/70">{r.body}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      <div className="rounded-2xl border border-yellow-500/40 bg-yellow-500/5 p-5">
        <Link
          href="/admin/reports/techrehab"
          className="font-display text-lg font-semibold text-navy-950 hover:underline"
        >
          → Techrehab investor view
        </Link>
        <p className="mt-1 text-sm text-navy-700/70">
          Capital deployed, recovered, at-risk, and cashflow projection.
          Exportable PDF for monthly CFO review.
        </p>
      </div>
    </div>
  );
}
