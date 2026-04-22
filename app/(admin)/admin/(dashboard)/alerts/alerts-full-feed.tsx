"use client";

import * as React from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, ShieldAlert, WifiOff, Clock } from "lucide-react";
import { useAdminAlerts, type AdminAlert } from "@/lib/admin/useAdminAlerts";
import { cn } from "@/lib/utils/cn";

const KIND_ICON: Record<AdminAlert["kind"], React.ComponentType<{ className?: string }>> = {
  dispute_opened: ShieldAlert,
  gateway_offline: WifiOff,
  installment_overdue: Clock,
  meter_fault: AlertTriangle,
};

const SEVERITY_BG: Record<AdminAlert["severity"], string> = {
  info: "bg-navy-100 text-navy-700",
  warning: "bg-amber/10 text-amber",
  critical: "bg-red/10 text-red",
};

export function AlertsFullFeed() {
  const { alerts, isLoading } = useAdminAlerts();
  const [filter, setFilter] = React.useState<"all" | AdminAlert["kind"]>("all");

  const filtered = alerts.filter((a) => filter === "all" || a.kind === filter);

  const counts = alerts.reduce<Record<string, number>>((acc, a) => {
    acc[a.kind] = (acc[a.kind] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="rounded-2xl border border-navy-100 bg-white p-5">
      <div className="flex flex-wrap items-center gap-2 border-b border-navy-100 pb-4">
        {(
          [
            ["all", "All"],
            ["dispute_opened", "Disputes"],
            ["gateway_offline", "Gateways"],
            ["installment_overdue", "Overdue"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors",
              filter === key
                ? "border-navy-950 bg-navy-950 text-white"
                : "border-navy-100 bg-white text-navy-700 hover:border-navy-700",
            )}
          >
            {label}
            {key !== "all" && counts[key] ? (
              <span className="ml-1 text-navy-700/60">· {counts[key]}</span>
            ) : null}
            {key === "all" ? (
              <span className="ml-1 text-navy-700/60">· {alerts.length}</span>
            ) : null}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-navy-700/50">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-navy-700/40">
          No alerts in this category.
        </p>
      ) : (
        <ul className="divide-y divide-navy-100">
          {filtered.map((a) => {
            const Icon = KIND_ICON[a.kind];
            return (
              <li key={a.id}>
                {a.href ? (
                  <Link
                    href={a.href}
                    className="flex items-start gap-3 py-3 hover:bg-offwhite"
                  >
                    <AlertRow alert={a} Icon={Icon} />
                  </Link>
                ) : (
                  <div className="flex items-start gap-3 py-3">
                    <AlertRow alert={a} Icon={Icon} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AlertRow({
  alert,
  Icon,
}: {
  alert: AdminAlert;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <>
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
          SEVERITY_BG[alert.severity],
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex-1">
        <p className="text-sm font-medium text-navy-950">{alert.title}</p>
        {alert.body ? (
          <p className="mt-0.5 text-xs text-navy-700/60">{alert.body}</p>
        ) : null}
      </div>
      <span className="mt-0.5 text-[10px] uppercase tracking-wider text-navy-700/40">
        {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
      </span>
    </>
  );
}
