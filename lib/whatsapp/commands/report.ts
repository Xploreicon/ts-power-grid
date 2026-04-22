import "server-only";
import type { CommandHandler } from "./types";
import { captureDisputeContext } from "@/lib/admin/dispute-context";

/**
 * REPORT <description> — create a dispute against the active connection.
 * Category defaults to 'auto_detect'; admin categorizes during triage.
 * Context snapshot is captured at creation time for investigation.
 */
export const reportHandler: CommandHandler = async (supabase, ctx, input) => {
  const description = input.args.trim();
  if (description.length < 10) {
    return {
      reply:
        'Please include a short description, e.g. "REPORT meter offline since morning".',
    };
  }
  if (!ctx.profile || !ctx.connection) {
    return {
      reply:
        "You need an active connection to raise a ticket. Ask your host to set one up.",
    };
  }

  // Capture context snapshot before creating the dispute
  let context = {};
  try {
    context = await captureDisputeContext(supabase, ctx.connection.id);
  } catch (err) {
    console.error("[report] context capture failed:", err);
  }

  const { data: dispute, error } = await supabase
    .from("disputes")
    .insert({
      raised_by: ctx.profile.id,
      connection_id: ctx.connection.id,
      category: "other", // auto_detect requires enum migration to be applied
      description: description.slice(0, 2000),
      context,
      source: "whatsapp",
    })
    .select("id")
    .single();

  if (error) {
    return {
      reply:
        "We couldn't save your ticket right now. Please try again, or call support.",
    };
  }

  // Notify admins
  try {
    const { dispatchNotification } = await import(
      "@/lib/notifications/dispatcher"
    );
    // Find admins to notify
    const { data: admins } = await supabase
      .from("profiles")
      .select("id")
      .in("role", ["admin", "super_admin"])
      .limit(10);

    for (const admin of admins ?? []) {
      await dispatchNotification(admin.id, "high_priority_dispute", {
        disputeId: dispute.id,
        siteId: "",
        category: "auto_detect",
        raisedBy: ctx.profile.full_name ?? ctx.senderPhone,
      }).catch(console.error);
    }
  } catch (err) {
    console.error("[report] admin notification failed:", err);
  }

  const caseId = dispute.id.slice(0, 8).toUpperCase();
  return {
    reply: `Thanks. Case #${caseId} created. We'll respond within 24 hours.`,
  };
};
