import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * PATCH /api/admin/config
 * body: { key: string, value: unknown, reason: string }
 *
 * Super-admin only. Upserts platform_config row and logs a billing_audit
 * entry with the before/after values and the reason.
 */
export async function PATCH(req: Request) {
  const session = await requireAdmin();
  if (session.role !== "super_admin") {
    return NextResponse.json({ error: "super_admin required" }, { status: 403 });
  }

  const { key, value, reason } = (await req.json()) as {
    key?: string;
    value?: unknown;
    reason?: string;
  };
  if (!key || value === undefined || !reason || !String(reason).trim()) {
    return NextResponse.json(
      { error: "key, value, reason required" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("platform_config")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  const { error } = await supabase
    .from("platform_config")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("billing_audit").insert({
    event_type: "platform_config.updated",
    actor_id: session.userId,
    metadata: {
      key,
      before: existing?.value ?? null,
      after: value,
      reason,
    },
  });

  return NextResponse.json({ ok: true });
}
