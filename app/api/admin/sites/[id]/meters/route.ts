import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/sites/[id]/meters
 *
 * Provision a meter against a gateway at a site. Admin-only. The
 * response includes the new meter_id (UUID) so the operator can paste
 * it into the Pi's `config.yaml` under the matching modbus_address.
 *
 * `meter_type` ('host' | 'neighbor') is the field the user calls
 * "role" — it's already encoded in the existing meter_type enum.
 */
const bodySchema = z.object({
  gatewayId: z.string().uuid(),
  serialNumber: z.string().min(3).max(64),
  meterType: z.enum(["host", "neighbor"]),
  modbusAddress: z.number().int().min(1).max(247),
  driver: z.enum(["pzem004t", "hexing_hxe110", "simulator"]),
  // user_id is required by the meters schema — for `host` meters it's
  // the site host; for `neighbor` meters the host enters it later when
  // they connect a neighbor (via `connect_neighbor` RPC). We accept an
  // explicit user_id but default to the host when omitted, so the UI
  // doesn't need a user picker for the common host-meter case.
  userId: z.string().uuid().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  await requireAdmin();
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad_request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const admin = createAdminClient();

  // Confirm the gateway is on this site — defends against the UI
  // passing a gateway from a different site (the form's select should
  // already filter, but the API is the canonical authority).
  const { data: gateway } = await admin
    .from("gateways")
    .select("id, site_id")
    .eq("id", input.gatewayId)
    .maybeSingle();
  if (!gateway) {
    return NextResponse.json({ error: "gateway_not_found" }, { status: 404 });
  }
  if (gateway.site_id !== params.id) {
    return NextResponse.json(
      { error: "gateway_belongs_to_other_site" },
      { status: 409 },
    );
  }

  // Pick a default user_id when not supplied — the site's host. For
  // neighbor-typed meters this is just a placeholder until the host
  // links the actual neighbor through `connect_neighbor`.
  let userId = input.userId;
  if (!userId) {
    const { data: site } = await admin
      .from("sites")
      .select("host_id")
      .eq("id", params.id)
      .maybeSingle();
    userId = (site?.host_id as string | undefined) ?? undefined;
  }
  if (!userId) {
    return NextResponse.json(
      { error: "user_id_unavailable" },
      { status: 400 },
    );
  }

  const { data, error } = await admin
    .from("meters")
    .insert({
      gateway_id: input.gatewayId,
      user_id: userId,
      serial_number: input.serialNumber,
      meter_type: input.meterType,
      modbus_address: input.modbusAddress,
      driver: input.driver,
      status: "active",
    })
    .select("id")
    .single();

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("meters_gateway_modbus_unique")) {
      return NextResponse.json(
        { error: "modbus_address_taken" },
        { status: 409 },
      );
    }
    if (msg.includes("duplicate")) {
      return NextResponse.json(
        { error: "duplicate_serial" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "insert_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: data.id });
}
