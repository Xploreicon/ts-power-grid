"use client";

import { ReportViewer } from "@/components/admin/report-viewer";

const META: Record<string, { title: string; description: string }> = {
  "revenue-monthly": {
    title: "Monthly revenue breakdown",
    description: "Gross revenue, platform fees, host earnings by month.",
  },
  "installment-collection": {
    title: "Installment collection",
    description: "Path-A installment performance.",
  },
  "default-rate": {
    title: "Default rate",
    description: "Installments >30 days overdue ÷ active installments.",
  },
  "gateway-uptime": {
    title: "Gateway uptime by site",
    description: "Reporting-window coverage over last 30 days.",
  },
  "meter-accuracy": {
    title: "Meter accuracy",
    description: "Reported vs expected kWh per meter.",
  },
  "neighbor-churn": {
    title: "Neighbor churn rate",
    description: "Active-to-disconnected conversion in each 30-day window.",
  },
  "host-earnings": {
    title: "Host earnings distribution",
    description: "Median / P90 monthly host payout.",
  },
  "platform-fee-trend": {
    title: "Platform fee revenue trend",
    description: "Daily platform-fee collection, rolling 90 days.",
  },
};

export function GenericReport({ slug }: { slug: string }) {
  const meta = META[slug]!;
  return (
    <ReportViewer
      title={meta.title}
      description={meta.description}
      emailEnabled
      csvRows={() => ({
        filename: slug,
        rows: [
          ["date", "value"],
          // TODO: wire to Supabase materialised view `report_${slug}`.
        ],
      })}
    >
      <p className="text-sm text-navy-700/60">
        Data for this report is sourced from a materialised view refreshed
        hourly. Wire <code>report_{slug}</code> in a follow-up to populate.
      </p>
    </ReportViewer>
  );
}
