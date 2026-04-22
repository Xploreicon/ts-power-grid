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

  const [gateways, meters, connections, billing, installments] =
    await Promise.all([
      supabase
        .from("gateways")
        .select("id, serial_number, status, hardware_version, firmware_version, last_seen_at")
        .eq("site_id", params.id),
      supabase
        .from("meters")
        .select("id, serial_number, meter_type, status, last_reading_kwh, user_id")
        .eq("gateway_id", params.id) // may be filtered again below
        .limit(500),
      supabase
        .from("connections")
        .select(
          "id, neighbor_id, current_price_per_kwh, status, started_at, profiles:neighbor_id(full_name, phone)",
        )
        .eq("site_id", params.id),
      supabase
        .from("billing_audit")
        .select("id, event_type, details, created_at")
        .eq("meter_id", params.id) // coarse; per-site audit needs its own index
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("installments")
        .select("id, installment_number, amount, status, due_date, paid_at")
        .eq("site_id", params.id)
        .order("installment_number", { ascending: true }),
    ]);

  return (
    <SiteDetailView
      site={site as never}
      gateways={(gateways.data ?? []) as never}
      meters={(meters.data ?? []) as never}
      connections={(connections.data ?? []) as never}
      billingAudit={(billing.data ?? []) as never}
      installments={(installments.data ?? []) as never}
    />
  );
}
