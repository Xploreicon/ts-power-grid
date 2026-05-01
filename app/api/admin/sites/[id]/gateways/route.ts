import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/sites/[id]/gateways
 *
 * Provision a new Pi gateway under a site. Admin-only.
 *
 * After this row exists, the operator runs `firmware/tools/provision.sh`
 * with the returned gateway_id to mint client certs and pairing token,
 * then ships the resulting bundle to the Pi.
 */
const bodySchema = z.object({
  serialNumber: z.string().min(3).max(64),
  hardwareVersion: z.string().max(32).optional(),
  firmwareVersion: z.string().max(32).optional(),
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

  const admin = createAdminClient();

  // Verify the site exists. The FK already enforces this on insert, but
  // the FK error message is opaque — surface a clean "site_not_found"
  // for the UI.
  const { data: site } = await admin
    .from("sites")
    .select("id")
    .eq("id", params.id)
    .maybeSingle();
  if (!site) {
    return NextResponse.json({ error: "site_not_found" }, { status: 404 });
  }

  const { data, error } = await admin
    .from("gateways")
    .insert({
      site_id: params.id,
      serial_number: parsed.data.serialNumber,
      hardware_version: parsed.data.hardwareVersion ?? null,
      firmware_version: parsed.data.firmwareVersion ?? null,
      status: "offline",
    })
    .select("id")
    .single();

  if (error) {
    if (error.message.toLowerCase().includes("duplicate")) {
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
