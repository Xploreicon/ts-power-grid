import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { SiteDetailView } from "./site-detail-view";

export const dynamic = "force-dynamic";

export default async function SiteDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createAdminClient();

  const { data: site } = await supabase
    .from("sites")
    .select(
      "id, host_id, address, installation_type, status, installed_at, solar_capacity_kw, battery_capacity_kwh, latitude, longitude, profiles:host_id(id, full_name, phone, email, kyc_status)",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!site) notFound();

  // Site → gateways → meters is a two-step lookup. The previous version
  // tried `meters.gateway_id = site.id` which always returned empty —
  // gateway_id is a uuid, site.id is a different uuid, they never match.
  // Resolve gateways first, then meters via the gateway IDs.
  const { data: gatewayRows } = await supabase
    .from("gateways")
    .select(
      "id, serial_number, status, hardware_version, firmware_version, last_seen_at",
    )
    .eq("site_id", params.id)
    .order("created_at", { ascending: true });
  const gateways = gatewayRows ?? [];
  const gatewayIds = gateways.map((g) => g.id as string);

  const [meters, connections, installments] = await Promise.all([
    gatewayIds.length
      ? supabase
          .from("meters")
          .select(
            "id, gateway_id, serial_number, meter_type, modbus_address, driver, status, last_reading_kwh, user_id",
          )
          .in("gateway_id", gatewayIds)
          .order("modbus_address", { ascending: true, nullsFirst: false })
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from("connections")
      .select(
        "id, neighbor_id, current_price_per_kwh, status, started_at, profiles:neighbor_id(full_name, phone)",
      )
      .eq("site_id", params.id),
    supabase
      .from("installments")
      .select("id, installment_number, amount, status, due_date, paid_at")
      .eq("site_id", params.id)
      .order("installment_number", { ascending: true }),
  ]);

  // Audit rows are keyed by meter_id, so scope to this site's meters.
  // Empty array → no rows fetched, which is the correct answer for a
  // site that has no meters yet.
  const meterRows = (meters.data ?? []) as Array<{ id: string }>;
  const meterIds = meterRows.map((m) => m.id);
  const { data: audit } = meterIds.length
    ? await supabase
        .from("billing_audit")
        .select("id, event_type, details, created_at, meter_id")
        .in("meter_id", meterIds)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] as never[] };

  return (
    <SiteDetailView
      siteId={params.id}
      site={site as never}
      gateways={gateways as never}
      meters={(meters.data ?? []) as never}
      connections={(connections.data ?? []) as never}
      billingAudit={(audit ?? []) as never}
      installments={(installments.data ?? []) as never}
    />
  );
}
