import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { publishCommand, type GatewayCommand } from "@/lib/mqtt/publisher";

const bodySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("disconnect_meter"),
    meter_id: z.string().uuid(),
    reason: z.string().optional(),
  }),
  z.object({
    type: z.literal("reconnect_meter"),
    meter_id: z.string().uuid(),
  }),
  z.object({
    type: z.literal("update_price"),
    price_kobo_per_kwh: z.number().int().positive(),
  }),
  z.object({ type: z.literal("reboot_gateway") }),
  z.object({ type: z.literal("reprovision") }),
  z.object({
    type: z.literal("update_firmware"),
    version: z.string().optional(),
    url: z.string().url().optional(),
    sha256: z.string().optional(),
  }),
]);

/**
 * POST /api/admin/gateways/[id]/command
 *
 * Resolves gateway → site, publishes the command on ts/sites/{site_id}/commands,
 * and audits the action. The gateway ack's asynchronously by publishing a
 * `command_ack` event that the ingest service writes to gateway_events.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await requireAdmin();
  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const command = parsed.data;

  const supabase = createAdminClient();
  const { data: gateway, error } = await supabase
    .from("gateways")
    .select("id, site_id, serial_number")
    .eq("id", params.id)
    .maybeSingle();
  if (error || !gateway) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // "reprovision" is admin-UI shorthand; wire-level we send it as a distinct
  // command. Until the gateway firmware supports it, treat it as an alias
  // for reboot_gateway so the round-trip works end-to-end in dev.
  const wireCommand: GatewayCommand =
    command.type === "reprovision"
      ? { type: "reboot_gateway" }
      : (command as GatewayCommand);

  let result;
  try {
    result = await publishCommand(gateway.site_id as string, wireCommand);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "publish_failed";
    await supabase.from("billing_audit").insert({
      event_type: "gateway_command_failed",
      details: {
        gateway_id: gateway.id,
        site_id: gateway.site_id,
        command,
        error: msg,
        admin_user_id: session.userId,
      },
    });
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  await supabase.from("billing_audit").insert({
    event_type: "gateway_command_issued",
    details: {
      gateway_id: gateway.id,
      site_id: gateway.site_id,
      serial_number: gateway.serial_number,
      command,
      command_id: result.commandId,
      admin_user_id: session.userId,
    },
  });

  return NextResponse.json({
    commandId: result.commandId,
    publishedAt: result.publishedAt,
  });
}
