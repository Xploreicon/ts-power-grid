/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/sla
 *
 * Runs periodically (e.g. every hour via Vercel cron or external trigger).
 * Finds disputes that have breached the 24-hour SLA and auto-escalates
 * them to super_admin.
 *
 * Protected by a bearer token check so only authorized cron runners can invoke.
 */
export async function GET(req: NextRequest) {
  // Simple auth: check for cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const twentyFourHoursAgo = new Date(
    Date.now() - 24 * 60 * 60 * 1000,
  ).toISOString();

  // Find open/investigating disputes older than 24 hours that haven't been escalated
  const { data: breached } = await supabase
    .from("disputes")
    .select("id, raised_by, connection_id, category")
    .in("status", ["open", "investigating"])
    .lt("created_at", twentyFourHoursAgo);

  if (!breached || breached.length === 0) {
    return NextResponse.json({ escalated: 0, message: "No SLA breaches found" });
  }

  // Find a super_admin to escalate to
  const { data: superAdmins } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "super_admin")
    .limit(1);

  const superAdminId = superAdmins?.[0]?.id ?? null;

  let escalatedCount = 0;

  for (const dispute of breached) {
    const patch: Record<string, unknown> = {
      status: "escalated",
      escalated_at: new Date().toISOString(),
    };
    if (superAdminId) {
      patch.escalated_to = superAdminId;
      patch.assigned_to = superAdminId;
    }

    const { error } = await supabase
      .from("disputes")
      .update(patch)
      .eq("id", dispute.id);

    if (!error) {
      escalatedCount += 1;

      // Add auto-escalation note
      await supabase.from("dispute_notes").insert({
        dispute_id: dispute.id,
        author_id: superAdminId ?? dispute.raised_by,
        body: "⚠️ Auto-escalated: SLA breached (>24 hours without resolution).",
      });

      // Notify super_admin
      if (superAdminId) {
        try {
          const { dispatchNotification } = await import(
            "@/lib/notifications/dispatcher"
          );
          await dispatchNotification(superAdminId, "high_priority_dispute", {
            disputeId: dispute.id,
            siteId: "",
            category: (dispute.category as string) ?? "sla_breach",
            raisedBy: "System (SLA Auto-Escalation)",
          }).catch(console.error);
        } catch (err) {
          console.error("[sla-cron] notification failed:", err);
        }
      }

      // Audit
      await supabase.from("billing_audit").insert({
        event_type: "dispute.sla_escalated",
        details: {
          dispute_id: dispute.id,
          escalated_to: superAdminId,
        },
      });
    }
  }

  return NextResponse.json({
    escalated: escalatedCount,
    total_breached: breached.length,
  });
}
