import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const siteSchema = z.object({
  address: z.string().min(5),
  lagosArea: z.string().min(2),
  hasSolar: z.boolean(),
  solarCapacityKw: z.number().positive().optional(),
  batteryCapacityKwh: z.number().positive().optional(),
  estimatedNeighborCount: z.number().int().min(0).optional(),
});

export async function POST(req: NextRequest) {
  const serverClient = createClient();
  const { data: { user }, error: authErr } = await serverClient.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = siteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { address, lagosArea, hasSolar, solarCapacityKw, batteryCapacityKwh } = parsed.data;

  const admin = createAdminClient();
  const { data: site, error: siteErr } = await admin
    .from("sites")
    .insert({
      host_id: user.id,
      address,
      lagos_area: lagosArea,
      installation_type: hasSolar ? "upgrade" : "full_stack",
      solar_capacity_kw: solarCapacityKw ?? 0,
      battery_capacity_kwh: batteryCapacityKwh ?? 0,
      status: "pending",
    })
    .select("id")
    .single();

  if (siteErr) {
    return NextResponse.json({ error: siteErr.message }, { status: 500 });
  }

  // Upgrade user role to host if not already.
  await admin
    .from("profiles")
    .update({ role: "host" })
    .eq("id", user.id)
    .in("role", ["neighbor"]);

  return NextResponse.json({ siteId: site.id });
}
