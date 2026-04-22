import { createAdminClient } from "@/lib/supabase/admin";
import { InventoryView } from "./inventory-view";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const supabase = createAdminClient();

  const { data: items } = await supabase
    .from("inventory_items")
    .select(
      "id, sku, name, category, current_stock, deployed, on_order, reorder_threshold, updated_at",
    )
    .order("category")
    .order("name");

  const { data: movements } = await supabase
    .from("inventory_movements")
    .select("id, item_id, kind, qty, note, created_at, actor_id")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Inventory</h1>
        <p className="text-sm text-navy-700/70">
          Real-time stock across panels, inverters, batteries, gateways, meters,
          and accessories.
        </p>
      </div>
      <InventoryView
        items={(items ?? []) as never}
        movements={(movements ?? []) as never}
      />
    </div>
  );
}
