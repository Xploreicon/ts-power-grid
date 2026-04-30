import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: gateway, error } = await supabase
    .from("gateways")
    .select(
      "id, serial_number, hardware_version, firmware_version, last_seen_at, status, cert_fingerprint, created_at, site_id, sites:site_id(address, installed_at, profiles:host_id(full_name, phone))",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!gateway) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [metersRes, eventsRes] = await Promise.all([
    supabase
      .from("meters")
      .select(
        "id, serial_number, meter_type, status, last_reading_kwh, updated_at",
      )
      .eq("gateway_id", params.id),
    supabase
      .from("gateway_events")
      .select("id, event_type, severity, details, created_at")
      .eq("gateway_id", params.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return NextResponse.json({
    gateway,
    meters: metersRes.data ?? [],
    events: eventsRes.data ?? [],
  });
}
