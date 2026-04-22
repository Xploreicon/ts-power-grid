"use client";

import * as React from "react";
import { format } from "date-fns";
import { StatusBadge } from "@/components/admin/status-badge";
import { AuditLog } from "@/components/admin/audit-log";
import { formatNgnKobo } from "@/lib/admin/format";
import { cn } from "@/lib/utils/cn";

type Tab = "equipment" | "consumption" | "financial" | "people" | "activity";

interface Site {
  id: string;
  address: string | null;
  installation_type: string | null;
  status: string | null;
  installed_at: string | null;
  solar_capacity_kw: number | null;
  battery_capacity_kwh: number | null;
  profiles: { full_name: string | null; phone: string | null; email: string | null } | null;
}
interface Gateway {
  id: string;
  serial_number: string;
  status: string;
  hardware_version: string | null;
  firmware_version: string | null;
  last_seen_at: string | null;
}
interface Meter {
  id: string;
  serial_number: string;
  meter_type: string;
  status: string;
  last_reading_kwh: number | null;
}
interface Connection {
  id: string;
  current_price_per_kwh: number | null;
  status: string;
  started_at: string | null;
  profiles: { full_name: string | null; phone: string | null } | null;
}
interface Installment {
  id: string;
  installment_number: number;
  amount: number;
  status: string;
  due_date: string;
  paid_at: string | null;
}
interface AuditRow {
  id: string;
  event_type: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export function SiteDetailView({
  site,
  gateways,
  meters,
  connections,
  billingAudit,
  installments,
}: {
  site: Site;
  gateways: Gateway[];
  meters: Meter[];
  connections: Connection[];
  billingAudit: AuditRow[];
  installments: Installment[];
}) {
  const [tab, setTab] = React.useState<Tab>("equipment");

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-navy-100 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold">
              {site.profiles?.full_name ?? "Host"}
            </h1>
            <p className="mt-1 text-navy-700/70">{site.address}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <StatusBadge status={site.status} />
              <span className="rounded-md bg-navy-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-navy-700">
                {site.installation_type?.replace(/_/g, " ") ?? "—"}
              </span>
              {site.installed_at ? (
                <span className="text-xs text-navy-700/70">
                  Installed {format(new Date(site.installed_at), "d MMM yyyy")}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex gap-2">
            <button className="rounded-lg border border-navy-100 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-offwhite">
              Pause site
            </button>
            <button className="rounded-lg border border-navy-100 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-offwhite">
              Schedule visit
            </button>
            <button className="rounded-lg border border-red bg-red/10 px-3 py-1.5 text-sm font-semibold text-red hover:bg-red/20">
              Decommission
            </button>
          </div>
        </div>
      </header>

      <div className="flex gap-1 border-b border-navy-100">
        {(["equipment", "consumption", "financial", "people", "activity"] as Tab[]).map(
          (t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "border-b-2 px-4 py-2 text-sm font-semibold capitalize transition-colors",
                tab === t
                  ? "border-yellow-500 text-navy-950"
                  : "border-transparent text-navy-700/60 hover:text-navy-950",
              )}
            >
              {t}
            </button>
          ),
        )}
      </div>

      {tab === "equipment" ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-navy-100 bg-white p-5">
            <h2 className="font-display text-lg font-semibold">Solar system</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs uppercase tracking-widest text-navy-700/60">
                  Capacity
                </dt>
                <dd className="font-mono">
                  {site.solar_capacity_kw ?? "—"} kW
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-widest text-navy-700/60">
                  Battery
                </dt>
                <dd className="font-mono">
                  {site.battery_capacity_kwh ?? "—"} kWh
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-navy-100 bg-white p-5">
            <h2 className="font-display text-lg font-semibold">Gateways</h2>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-navy-700/60">
                <tr>
                  <th className="py-2">Serial</th>
                  <th>Status</th>
                  <th>Firmware</th>
                  <th>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {gateways.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-navy-700/60">
                      No gateways registered.
                    </td>
                  </tr>
                ) : (
                  gateways.map((g) => (
                    <tr key={g.id} className="border-t border-navy-100">
                      <td className="py-2 font-mono">{g.serial_number}</td>
                      <td>
                        <StatusBadge status={g.status} />
                      </td>
                      <td className="font-mono text-xs">{g.firmware_version ?? "—"}</td>
                      <td className="font-mono text-xs">
                        {g.last_seen_at
                          ? format(new Date(g.last_seen_at), "d MMM HH:mm")
                          : "never"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl border border-navy-100 bg-white p-5">
            <h2 className="font-display text-lg font-semibold">Meters</h2>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-navy-700/60">
                <tr>
                  <th className="py-2">Serial</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Last reading</th>
                </tr>
              </thead>
              <tbody>
                {meters.map((m) => (
                  <tr key={m.id} className="border-t border-navy-100">
                    <td className="py-2 font-mono">{m.serial_number}</td>
                    <td className="capitalize">{m.meter_type}</td>
                    <td><StatusBadge status={m.status} /></td>
                    <td className="font-mono">{m.last_reading_kwh ?? "—"} kWh</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === "consumption" ? (
        <section className="rounded-2xl border border-navy-100 bg-white p-5">
          <p className="text-sm text-navy-700/60">
            30-day generation vs consumption chart — wire to telemetry table
            when metrics endpoint ships.
          </p>
        </section>
      ) : null}

      {tab === "financial" ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-navy-100 bg-white p-5">
            <h2 className="font-display text-lg font-semibold">Installments</h2>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-navy-700/60">
                <tr>
                  <th className="py-2">#</th>
                  <th>Amount</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Paid</th>
                </tr>
              </thead>
              <tbody>
                {installments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-navy-700/60">
                      No installments on this site.
                    </td>
                  </tr>
                ) : (
                  installments.map((i) => (
                    <tr key={i.id} className="border-t border-navy-100">
                      <td className="py-2 font-mono">{i.installment_number}</td>
                      <td className="font-mono">{formatNgnKobo(i.amount)}</td>
                      <td className="font-mono text-xs">{i.due_date}</td>
                      <td><StatusBadge status={i.status} /></td>
                      <td className="font-mono text-xs">
                        {i.paid_at ? format(new Date(i.paid_at), "d MMM") : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === "people" ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-navy-100 bg-white p-5">
            <h2 className="font-display text-lg font-semibold">Host</h2>
            <dl className="mt-3 grid grid-cols-[120px_1fr] gap-y-1 text-sm">
              <dt className="text-navy-700/60">Name</dt>
              <dd>{site.profiles?.full_name ?? "—"}</dd>
              <dt className="text-navy-700/60">Phone</dt>
              <dd className="font-mono">{site.profiles?.phone ?? "—"}</dd>
              <dt className="text-navy-700/60">Email</dt>
              <dd>{site.profiles?.email ?? "—"}</dd>
            </dl>
          </div>
          <div className="rounded-2xl border border-navy-100 bg-white p-5">
            <h2 className="font-display text-lg font-semibold">
              Neighbors ({connections.length})
            </h2>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-navy-700/60">
                <tr>
                  <th className="py-2">Name</th>
                  <th>Phone</th>
                  <th>Price / kWh</th>
                  <th>Status</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                {connections.map((c) => (
                  <tr key={c.id} className="border-t border-navy-100">
                    <td className="py-2">{c.profiles?.full_name ?? "—"}</td>
                    <td className="font-mono">{c.profiles?.phone ?? "—"}</td>
                    <td className="font-mono">
                      ₦{Number(c.current_price_per_kwh ?? 0)}
                    </td>
                    <td><StatusBadge status={c.status} /></td>
                    <td className="font-mono text-xs">
                      {c.started_at ? format(new Date(c.started_at), "d MMM yyyy") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === "activity" ? (
        <section className="rounded-2xl border border-navy-100 bg-white p-5">
          <AuditLog
            events={billingAudit.map((a) => ({
              id: a.id,
              type: a.event_type,
              at: a.created_at,
              details: a.details ?? undefined,
            }))}
          />
        </section>
      ) : null}
    </div>
  );
}
