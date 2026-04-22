/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/disputes/[id]
 *
 * Comprehensive dispute update endpoint supporting:
 *   - Status transitions (open → investigating → resolved/rejected/escalated/awaiting_info)
 *   - Assignment
 *   - Internal notes
 *   - Refund processing (resolve with refund)
 *   - Escalation to super_admin
 *   - Request more info
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await requireAdmin();
  const supabase = createAdminClient();
  const body = (await req.json()) as Record<string, unknown>;

  const patch: Record<string, unknown> = {};

  // Assignment
  if (body.assign_to_me === true) {
    patch.assigned_to = session.userId;
  }

  // Status change
  if (typeof body.status === "string") {
    patch.status = body.status;
    if (body.status === "resolved" || body.status === "rejected") {
      patch.resolved_at = new Date().toISOString();
      patch.resolved_by = session.userId;
      if (typeof body.resolution === "string") {
        patch.resolution = body.resolution;
      }
    }
  }

  // Escalation
  if (body.escalate === true) {
    patch.status = "escalated";
    patch.escalated_at = new Date().toISOString();
    // Find a super_admin to assign to
    const { data: superAdmins } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "super_admin")
      .limit(1);
    if (superAdmins && superAdmins.length > 0) {
      patch.escalated_to = superAdmins[0].id;
      patch.assigned_to = superAdmins[0].id;
    }
  }

  // Refund processing
  if (body.action === "issue_refund" && body.refund) {
    const refund = body.refund as {
      amountKobo: number;
      source: string;
      recipientId: string;
      hostId?: string;
      connectionId?: string;
    };

    // Permission check: regular admin can't refund > ₦10K
    if (session.role !== "super_admin" && refund.amountKobo > 1_000_000) {
      return NextResponse.json(
        { error: "Refunds over ₦10,000 require super_admin approval" },
        { status: 403 },
      );
    }

    try {
      const { processRefund } = await import("@/lib/billing/refund");
      const result = await processRefund(supabase, {
        disputeId: params.id,
        amountKobo: refund.amountKobo,
        source: refund.source,
        recipientId: refund.recipientId,
        hostId: refund.hostId,
        connectionId: refund.connectionId,
      });

      await supabase.from("billing_audit").insert({
        event_type: "dispute.refund_processed",
        details: {
          dispute_id: params.id,
          actor: session.userId,
          ...result,
        },
      });
    } catch (err: any) {
      return NextResponse.json(
        { error: err.message ?? "Refund failed" },
        { status: 400 },
      );
    }
  }

  // Internal note
  if (typeof body.internal_note === "string" && body.internal_note.trim()) {
    await supabase.from("dispute_notes").insert({
      dispute_id: params.id,
      author_id: session.userId,
      body: body.internal_note.trim().slice(0, 4000),
    });
  }

  // Apply patch
  if (Object.keys(patch).length > 0) {
    const { data: dispute, error } = await supabase
      .from("disputes")
      .update(patch)
      .eq("id", params.id)
      .select("id, raised_by, connection_id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Notifications
    try {
      const { dispatchNotification } = await import(
        "@/lib/notifications/dispatcher"
      );

      // Notify reporter on resolution/rejection
      if (patch.status === "resolved" || patch.status === "rejected") {
        if (dispute.raised_by) {
          await dispatchNotification(
            dispute.raised_by as string,
            "dispute_resolution",
            {
              disputeId: dispute.id,
              resolution: patch.status,
              message: body.resolution ?? "",
            },
          ).catch(console.error);
        }

        // Also notify the host if different from reporter
        if (dispute.connection_id) {
          const { data: conn } = await supabase
            .from("connections")
            .select("host_id")
            .eq("id", dispute.connection_id)
            .maybeSingle();
          if (conn?.host_id && conn.host_id !== dispute.raised_by) {
            await dispatchNotification(conn.host_id, "dispute_resolution", {
              disputeId: dispute.id,
              resolution: patch.status,
            }).catch(console.error);
          }
        }
      }

      // Notify on escalation
      if (patch.status === "escalated" && patch.escalated_to) {
        await dispatchNotification(
          patch.escalated_to as string,
          "high_priority_dispute",
          {
            disputeId: dispute.id,
            siteId: "",
            category: "escalated",
            raisedBy: session.fullName ?? session.email ?? "Admin",
          },
        ).catch(console.error);
      }
    } catch (err) {
      console.error("[disputes] notification dispatch failed:", err);
    }
  }

  // Audit trail
  await supabase.from("billing_audit").insert({
    event_type: "dispute.updated",
    details: { dispute_id: params.id, actor: session.userId, patch, body },
  });

  return NextResponse.json({ ok: true });
}
