import { createAdminClient } from "@/lib/supabase/admin";
import { GatewaysTable } from "./gateways-table";

export const dynamic = "force-dynamic";

// A gateway that hasn't beaconed in this long is "offline" regardless of
// its stored status column. Heartbeat cadence is 5 min, so 30 min = six
// missed beats — comfortable margin for a transient outage.
export const OFFLINE_THRESHOLD_MS = 30 * 60 * 1000;

export type DerivedStatus = "online" | "offline" | "faulty";

export interface GatewayRow {
  id: string;
  serial_number: string;
  hardware_version: string | null;
  firmware_version: string | null;
  last_seen_at: string | null;
  status_column: string | null;
  derived_status: DerivedStatus;
  site_id: string;
  site_address: string | null;
  host_name: string | null;
  meter_count: number;
}

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

export default async function GatewaysPage() {
  const supabase = createAdminClient();

  const { data: gateways } = await supabase
    .from("gateways")
    .select(
      "id, serial_number, hardware_version, firmware_version, last_seen_at, status, site_id, sites:site_id(address, host_id, profiles:host_id(full_name))",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const gatewayIds = (gateways ?? []).map((g) => g.id as string);
  const { data: meters } = await supabase
    .from("meters")
    .select("gateway_id")
    .in("gateway_id", gatewayIds.length ? gatewayIds : ["__none__"]);

  const meterCount = new Map<string, number>();
  for (const m of meters ?? []) {
    const gid = m.gateway_id as string;
    meterCount.set(gid, (meterCount.get(gid) ?? 0) + 1);
  }

  const rows: GatewayRow[] = (gateways ?? []).map((g) => {
    const site = (g.sites as unknown) as
      | {
          address: string | null;
          profiles: { full_name: string | null } | null;
        }
      | null;
    const lastSeen = (g.last_seen_at as string | null) ?? null;
    const statusCol = (g.status as string | null) ?? null;
    return {
      id: g.id as string,
      serial_number: g.serial_number as string,
      hardware_version: (g.hardware_version as string | null) ?? null,
      firmware_version: (g.firmware_version as string | null) ?? null,
      last_seen_at: lastSeen,
      status_column: statusCol,
      derived_status: deriveStatus(statusCol, lastSeen),
      site_id: g.site_id as string,
      site_address: site?.address ?? null,
      host_name: site?.profiles?.full_name ?? null,
      meter_count: meterCount.get(g.id as string) ?? 0,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Gateways</h1>
        <p className="text-sm text-navy-700/70">
          Fleet of Gateway Hubs deployed at host sites.
        </p>
      </div>
      <GatewaysTable rows={rows} />
    </div>
  );
}
