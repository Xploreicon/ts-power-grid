"use client";

import * as React from "react";
import { format } from "date-fns";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";

interface Item {
  id: string;
  sku: string;
  name: string;
  category: string;
  current_stock: number;
  deployed: number;
  on_order: number;
  reorder_threshold: number;
}
interface Movement {
  id: string;
  item_id: string;
  kind: "received" | "deployed" | "adjusted";
  qty: number;
  note: string | null;
  created_at: string;
}

const CATEGORY_ORDER = [
  "solar_panel",
  "inverter",
  "battery",
  "gateway",
  "meter",
  "accessory",
] as const;

export function InventoryView({
  items,
  movements,
}: {
  items: Item[];
  movements: Movement[];
}) {
  const [adding, setAdding] = React.useState<Item | null>(null);

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: items.filter((i) => i.category === cat),
  })).filter((g) => g.items.length > 0);

  const lowStock = items.filter(
    (i) => i.current_stock <= i.reorder_threshold,
  );

  return (
    <>
      {lowStock.length > 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber/40 bg-amber/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-amber" />
          <div>
            <p className="font-semibold text-navy-950">
              {lowStock.length} item{lowStock.length === 1 ? "" : "s"} below reorder threshold
            </p>
            <p className="text-navy-700/70">
              {lowStock.map((i) => i.sku).join(", ")}
            </p>
          </div>
        </div>
      ) : null}

      {grouped.map((g) => (
        <section key={g.category} className="rounded-2xl border border-navy-100 bg-white">
          <h2 className="border-b border-navy-100 p-4 font-display text-lg font-semibold capitalize">
            {g.category.replace(/_/g, " ")}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
            <thead className="bg-offwhite text-xs uppercase tracking-wider text-navy-700/70">
              <tr>
                <th className="px-4 py-2">SKU</th>
                <th>Name</th>
                <th className="text-right">In stock</th>
                <th className="text-right">Deployed</th>
                <th className="text-right">On order</th>
                <th className="text-right">Reorder @</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {g.items.map((i) => {
                const low = i.current_stock <= i.reorder_threshold;
                return (
                  <tr key={i.id} className="border-t border-navy-100">
                    <td className="px-4 py-2 font-mono text-xs">{i.sku}</td>
                    <td>{i.name}</td>
                    <td
                      className={cn(
                        "text-right font-mono font-semibold",
                        low && "text-red",
                      )}
                    >
                      {i.current_stock}
                    </td>
                    <td className="text-right font-mono">{i.deployed}</td>
                    <td className="text-right font-mono">{i.on_order}</td>
                    <td className="text-right font-mono text-navy-700/60">
                      {i.reorder_threshold}
                    </td>
                    <td className="pr-4 text-right">
                      <button
                        type="button"
                        onClick={() => setAdding(i)}
                        className="text-xs font-semibold text-navy-950 hover:underline"
                      >
                        + Add stock
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      ))}

      <section className="rounded-2xl border border-navy-100 bg-white">
        <h2 className="border-b border-navy-100 p-4 font-display text-lg font-semibold">
          Recent movements
        </h2>
        <ul className="divide-y divide-navy-100 text-sm">
          {movements.length === 0 ? (
            <li className="p-4 text-navy-700/60">No movements recorded yet.</li>
          ) : (
            movements.map((m) => (
              <li key={m.id} className="flex items-baseline gap-3 p-3">
                <span className="font-mono text-xs text-navy-700/60">
                  {format(new Date(m.created_at), "d MMM HH:mm")}
                </span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-xs font-bold uppercase",
                    m.kind === "received" && "bg-green/10 text-green",
                    m.kind === "deployed" && "bg-navy-100 text-navy-700",
                    m.kind === "adjusted" && "bg-amber/10 text-amber",
                  )}
                >
                  {m.kind}
                </span>
                <span className="font-mono font-semibold">
                  {m.kind === "received" ? "+" : m.kind === "deployed" ? "−" : "±"}
                  {Math.abs(m.qty)}
                </span>
                <span className="text-navy-700/70">{m.note ?? ""}</span>
              </li>
            ))
          )}
        </ul>
      </section>

      {adding ? (
        <AddStockModal item={adding} onClose={() => setAdding(null)} />
      ) : null}
    </>
  );
}

function AddStockModal({
  item,
  onClose,
}: {
  item: Item;
  onClose: () => void;
}) {
  const [qty, setQty] = React.useState(0);
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    if (qty <= 0) return;
    setSaving(true);
    const res = await fetch("/api/admin/inventory/receive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: item.id, qty, note }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success(`Added ${qty} × ${item.sku}`);
      onClose();
      window.location.reload();
    } else {
      toast.error("Save failed");
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-navy-950/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <h3 className="font-display text-lg font-semibold">
          Receive stock: {item.sku}
        </h3>
        <p className="mt-1 text-sm text-navy-700/70">{item.name}</p>
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-navy-700/60">Quantity received</span>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-navy-100 bg-white px-3 py-2 font-mono text-lg"
            />
          </label>
          <label className="block text-sm">
            <span className="text-navy-700/60">Note (supplier, PO #…)</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-lg border border-navy-100 bg-white px-3 py-2"
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-navy-100 px-4 py-2 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || qty <= 0}
            className="rounded-lg bg-navy-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
