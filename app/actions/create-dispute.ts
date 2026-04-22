"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureDisputeContext } from "@/lib/admin/dispute-context";
import { z } from "zod";

const disputeSchema = z.object({
  connectionId: z.string().uuid(),
  category: z.enum(["billing", "disconnect", "meter_fault", "pricing", "other"]),
  description: z.string().min(20, "Description must be at least 20 characters"),
  photos: z.array(z.string().url()).max(3).optional(),
});

export async function createDispute(input: unknown) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const parsed = disputeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { connectionId, category, description, photos } = parsed.data;

  // Verify user owns this connection as host
  const admin = createAdminClient();
  const { data: conn } = await admin
    .from("connections")
    .select("id, host_id")
    .eq("id", connectionId)
    .maybeSingle();

  if (!conn || conn.host_id !== user.id) {
    return { error: "Connection not found or access denied" };
  }

  // Capture context snapshot
  let context = {};
  try {
    context = await captureDisputeContext(admin, connectionId);
  } catch (err) {
    console.error("[createDispute] context capture failed:", err);
  }

  // Create the dispute
  const { data: dispute, error } = await admin
    .from("disputes")
    .insert({
      raised_by: user.id,
      connection_id: connectionId,
      category,
      description,
      context,
      source: "pwa",
      photos: photos ?? [],
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  // Notify admins
  try {
    const { dispatchNotification } = await import(
      "@/lib/notifications/dispatcher"
    );
    const { data: admins } = await admin
      .from("profiles")
      .select("id")
      .in("role", ["admin", "super_admin"])
      .limit(10);

    for (const a of admins ?? []) {
      await dispatchNotification(a.id, "high_priority_dispute", {
        disputeId: dispute.id,
        siteId: "",
        category,
      }).catch(console.error);
    }
  } catch (err) {
    console.error("[createDispute] admin notify failed:", err);
  }

  return { disputeId: dispute.id };
}
