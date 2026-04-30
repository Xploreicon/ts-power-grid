import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDistanceToNowStrict, format } from "date-fns";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils/cn";
import { OFFLINE_THRESHOLD_MS, type DerivedStatus } from "../page";
import { GatewayCommandPanel } from "./gateway-command-panel";

export const dynamic = "force-dynamic";

function deriveStatus(
  statusColumn: string | null,
  lastSeenAt: string | null,
): DerivedStatus {
  if (statusColumn === "faulty") return "faulty";
  if (!lastSeenAt) return "offline";
  const age = Date.now() - new Date(lastSeenAt).getTime();
  if (age > OFFLINE_THRESHOLD_MS) return "offline";
  return "online";
}

const DOT: Record<DerivedStatus, string> = {
  online: "bg-green",
  offline: "bg-red",
  faulty: "bg-amber",
};

export default async function GatewayDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createAdminClient();

  const { data: gateway } = await supabase
    .from("gateways")
    .select(
      "id, serial_number, hardware_version, firmware_version, last_seen_at, status, cert_fingerprint, created_at, site_id, sites:site_id(address, installed_at, profiles:host_id(full_name, phone))",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!gateway) notFound();

  const [{ data: meters }, { data: events }] = await Promise.all([
    supabase
      .from("meters")
      .select(
        "id, serial_number, meter_type, status, last_reading_kwh, updated_at",
      )
      .eq("gateway_id", params.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("gateway_events")
      .select("id, event_type, severity, details, created_at")
      .eq("gateway_id", params.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const site = (gateway.sites as unknown) as
    | {
        address: string | null;
        installed_at: string | null;
        profiles: { full_name: string | null; phone: string | null } | null;
      }
    | null;

  const derived = deriveStatus(
    (gateway.status as string | null) ?? null,
    (gateway.last_seen_at as string | null) ?? null,
  );

  const fp = (gateway.cert_fingerprint as string | null) ?? null;
  const fpShort = fp ? `${fp.slice(0, 8)}…${fp.slice(-8)}` : "—";

  return (
    <div className="space-y-6">
      <Link
        href="/admin/gateways"
        className="inline-flex items-center gap-1 text-sm font-medium text-navy-700 hover:text-navy-950"
      >
        <ArrowLeft className="h-4 w-4" /> All gateways
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-semibold">
            {gateway.serial_number as string}
          </h1>
          <p className="text-sm text-navy-700/70">
            {site?.address ?? "—"} · Host {site?.profiles?.full_name ?? "—"}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-navy-50 px-3 py-1.5 text-sm font-semibold capitalize">
          <span className={cn("h-2 w-2 rounded-full", DOT[derived])} />
          {derived}
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <InfoCard
          label="Hardware"
          value={(gateway.hardware_version as string | null) ?? "—"}
        />
        <InfoCard
          label="Firmware"
          value={(gateway.firmware_version as string | null) ?? "—"}
          mono
        />
        <InfoCard
          label="Last seen"
          value={
            gateway.last_seen_at
              ? formatDistanceToNowStrict(
                  new Date(gateway.last_seen_at as string),
                  { addSuffix: true },
                )
              : "never"
          }
        />
        <InfoCard
          label="Installed"
          value={
            site?.installed_at
              ? format(new Date(site.installed_at), "d MMM yyyy")
              : "—"
          }
        />
        <InfoCard
          label="Cert fingerprint"
          value={fpShort}
          mono
          title={fp ?? undefined}
        />
      </div>

      {/* Meters */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Connected meters</h2>
        <div className="overflow-x-auto rounded-xl border border-navy-100 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-navy-50 text-left text-xs uppercase tracking-wide text-navy-700">
              <tr>
                <th className="px-4 py-2">Serial</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Last reading</th>
                <th className="px-4 py-2">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {(meters ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-navy-700/60">
                    No meters attached.
                  </td>
                </tr>
              ) : (
                (meters ?? []).map((m) => (
                  <tr key={m.id as string}>
                    <td className="px-4 py-2 font-mono">{m.serial_number as string}</td>
                    <td className="px-4 py-2 capitalize">
                      {(m.meter_type as string)?.replace(/_/g, " ") ?? "—"}
                    </td>
                    <td className="px-4 py-2 capitalize">
                      {(m.status as string) ?? "—"}
                    </td>
                    <td className="px-4 py-2 font-mono">
                      {m.last_reading_kwh != null
                        ? `${Number(m.last_reading_kwh).toFixed(3)} kWh`
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-navy-700">
                      {m.updated_at
                        ? formatDistanceToNowStrict(
                            new Date(m.updated_at as string),
                            { addSuffix: true },
                          )
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Commands */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Remote commands</h2>
        <GatewayCommandPanel gatewayId={gateway.id as string} />
      </section>

      {/* Events */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Recent events</h2>
        <div className="overflow-hidden rounded-xl border border-navy-100 bg-white">
          {(events ?? []).length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-navy-700/60">
              No events logged yet.
            </div>
          ) : (
            <ul className="divide-y divide-navy-50">
              {(events ?? []).map((e) => (
                <li
                  key={String(e.id)}
                  className="flex items-start justify-between gap-4 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <SeverityDot severity={(e.severity as string) ?? "info"} />
                      <span className="font-mono font-semibold">
                        {e.event_type as string}
                      </span>
                    </div>
                    {e.details &&
                      typeof e.details === "object" &&
                      Object.keys(e.details as Record<string, unknown>).length > 0 && (
                        <pre className="mt-1 max-w-full overflow-x-auto rounded bg-navy-50 p-2 text-xs text-navy-700">
                          {JSON.stringify(e.details, null, 2)}
                        </pre>
                      )}
                  </div>
                  <time className="shrink-0 text-xs text-navy-700/70">
                    {formatDistanceToNowStrict(
                      new Date(e.created_at as string),
                      { addSuffix: true },
                    )}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <Link
        href={`/admin/sites/${gateway.site_id}`}
        className="inline-flex items-center gap-1 text-sm font-semibold text-navy-700 hover:text-navy-950"
      >
        View site <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function InfoCard({
  label,
  value,
  mono,
  title,
}: {
  label: string;
  value: string;
  mono?: boolean;
  title?: string;
}) {
  return (
    <div
      className="rounded-xl border border-navy-100 bg-white p-4"
      title={title}
    >
      <div className="text-[11px] font-bold uppercase tracking-wider text-navy-700/60">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-sm font-semibold text-navy-900",
          mono && "font-mono",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function SeverityDot({ severity }: { severity: string }) {
  const color =
    severity === "critical" || severity === "error"
      ? "bg-red"
      : severity === "warning"
        ? "bg-amber"
        : "bg-navy-300";
  return <span className={cn("h-2 w-2 rounded-full", color)} />;
}
