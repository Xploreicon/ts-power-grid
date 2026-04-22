import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  const supabase = createAdminClient();
  const { item_id, qty, note } = (await req.json()) as {
    item_id?: string;
    qty?: number;
    note?: string;
  };

  if (!item_id || !qty || qty <= 0) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  const { data: item, error: fetchErr } = await supabase
    .from("inventory_items")
    .select("current_stock")
    .eq("id", item_id)
    .maybeSingle();
  if (fetchErr || !item) {
    return NextResponse.json({ error: "item not found" }, { status: 404 });
  }

  const newStock = Number(item.current_stock ?? 0) + qty;
  const { error: updateErr } = await supabase
    .from("inventory_items")
    .update({ current_stock: newStock, updated_at: new Date().toISOString() })
    .eq("id", item_id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  await supabase.from("inventory_movements").insert({
    item_id,
    kind: "received",
    qty,
    note: note?.slice(0, 200) ?? null,
    actor_id: session.userId,
  });

  await supabase.from("billing_audit").insert({
    event_type: "inventory.received",
    details: { item_id, qty, note, actor: session.userId },
  });

  return NextResponse.json({ ok: true, new_stock: newStock });
}
