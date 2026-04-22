import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/installations/[id]
 * Supports stage transitions, technician assignment, scheduled date.
 * Every change writes an installation_audit row.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await requireAdmin();
  const supabase = createAdminClient();
  const body = (await req.json()) as Record<string, unknown>;

  const patch: Record<string, unknown> = {};
  if (typeof body.stage === "string") patch.stage = body.stage;
  if (typeof body.assigned_technician === "string")
    patch.assigned_technician = body.assigned_technician;
  if (typeof body.scheduled_at === "string") patch.scheduled_at = body.scheduled_at;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no-op" }, { status: 400 });
  }

  patch.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from("installations")
    .update(patch)
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from("billing_audit").insert({
    event_type: "installation.updated",
    details: { installation_id: params.id, actor: session.userId, patch },
  });

  return NextResponse.json({ ok: true });
}
