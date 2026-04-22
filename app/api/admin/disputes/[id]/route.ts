/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/disputes/[id]
 *
 * Fields accepted:
 *   - assign_to_me: boolean  — sets assigned_to to actor
 *   - status: "open"|"investigating"|"resolved"|"rejected"
 *   - internal_note: string  — appended to dispute_notes
 *   - action: "issue_refund" (super_admin only — stub; wire to refund flow)
 *
 * Every change lands in billing_audit so /admin/audit can reconstruct.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await requireAdmin();
  const supabase = createAdminClient();
  const body = (await req.json()) as Record<string, unknown>;

  const patch: Record<string, unknown> = {};
  if (body.assign_to_me === true) {
    patch.assigned_to = session.userId;
  }
  if (typeof body.status === "string") {
    patch.status = body.status;
    if (body.status === "resolved" || body.status === "rejected") {
      patch.resolved_at = new Date().toISOString();
      patch.resolved_by = session.userId;
    }
  }

  if (body.action === "issue_refund") {
    if (session.role !== "super_admin") {
      return NextResponse.json(
        { error: "super_admin only" },
        { status: 403 },
      );
    }
    // TODO: wire into lib/paystack/withdrawal.ts refund flow.
    await supabase.from("billing_audit").insert({
      event_type: "dispute.refund_requested",
      details: { dispute_id: params.id, actor: session.userId },
    });
  }

  if (typeof body.internal_note === "string" && body.internal_note.trim()) {
    await supabase.from("dispute_notes").insert({
      dispute_id: params.id,
      author_id: session.userId,
      body: body.internal_note.trim().slice(0, 4000),
    });
  }

  if (Object.keys(patch).length > 0) {
    const { data: dispute, error } = await supabase
      .from("disputes")
      .update(patch)
      .eq("id", params.id)
      .select("id, raised_by, connections(host_id)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // If resolved, notify the host
    if (patch.status === "resolved" || patch.status === "rejected") {
      const hostId = (dispute.connections as any)?.host_id;
      if (hostId) {
        // dynamic import to avoid circular dependencies if any
        const { dispatchNotification } = await import("@/lib/notifications/dispatcher");
        await dispatchNotification(hostId, "dispute_resolution", {
          disputeId: dispute.id,
          resolution: patch.status,
        }).catch(console.error);
      }
    }
  }

  await supabase.from("billing_audit").insert({
    event_type: "dispute.updated",
    details: { dispute_id: params.id, actor: session.userId, patch, body },
  });

  return NextResponse.json({ ok: true });
}
