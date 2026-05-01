import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/sites
 *
 * Admin-only site provisioning. Distinct from the host-facing
 * `/api/onboarding/site` because:
 *   - the actor is an admin, not the site's host
 *   - capacity / lagos_area aren't required up front (we typically
 *     don't know them before the site survey)
 *   - the host_id is supplied explicitly rather than inferred from
 *     `auth.getUser()`
 *
 * Returns the new site's id so the UI can redirect to its detail page.
 */
const bodySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  address: z.string().min(5).max(500),
  hostId: z.string().uuid(),
  installationType: z.enum(["full_stack", "upgrade"]).optional(),
});

export async function POST(req: NextRequest) {
  await requireAdmin();
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad_request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { name, address, hostId, installationType } = parsed.data;

  const admin = createAdminClient();

  // Verify the host exists and has the right role. We don't auto-promote
  // — if the operator picked the wrong user the API should refuse and
  // tell them, rather than silently creating a site under a neighbor.
  const { data: profile } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", hostId)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: "host_not_found" }, { status: 404 });
  }
  if (!["host", "admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json(
      { error: "user_not_a_host", role: profile.role },
      { status: 409 },
    );
  }

  const { data, error } = await admin
    .from("sites")
    .insert({
      host_id: hostId,
      name: name ?? null,
      address,
      installation_type: installationType ?? "full_stack",
      // Capacity is captured during the survey, not at create time.
      // Schema requires NOT NULL, so seed zeros — admins update later.
      solar_capacity_kw: 0,
      battery_capacity_kwh: 0,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "insert_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: data.id });
}
