"use client";

import * as React from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import {
  Search,
  User,
  Building2,
  ScrollText,
  MessageSquareWarning,
  Wrench,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Result = {
  id: string;
  kind: "customer" | "site" | "transaction" | "dispute" | "installation";
  label: string;
  sub?: string;
  href: string;
};

const ICONS: Record<Result["kind"], React.ComponentType<{ className?: string }>> = {
  customer: User,
  site: Building2,
  transaction: ScrollText,
  dispute: MessageSquareWarning,
  installation: Wrench,
};

/**
 * Cmd/Ctrl+K palette, cross-entity search. Debounced at 150ms.
 * Runs parallel Supabase queries per entity, caps each at 5 rows. All
 * queries are client-side (user's RLS is admin or super_admin).
 */
export function SearchPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<Result[]>([]);
  const supabase = createClient();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    if (!supabase || !query.trim() || query.length < 2) {
      setResults([]);
      return;
    }
    const q = query.trim();
    const handle = setTimeout(async () => {
      const like = `%${q}%`;
      const [customers, sites, transactions, disputes, installations] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, phone, email, role")
            .or(`full_name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
            .in("role", ["host", "neighbor"])
            .limit(5),
          supabase
            .from("sites")
            .select("id, name, address")
            .or(`name.ilike.${like},address.ilike.${like}`)
            .limit(5),
          supabase
            .from("wallet_transactions")
            .select("id, reference, amount, type")
            .ilike("reference", like)
            .limit(5),
          supabase
            .from("disputes")
            .select("id, category, description")
            .ilike("description", like)
            .limit(5),
          supabase
            .from("installations")
            .select("id, stage, site_id, contract_number")
            .or(`contract_number.ilike.${like}`)
            .limit(5),
        ]);

      const next: Result[] = [];
      for (const c of customers.data ?? []) {
        next.push({
          id: `customer:${c.id}`,
          kind: "customer",
          label: (c.full_name as string) ?? (c.phone as string) ?? "Unnamed",
          sub: `${c.role} · ${c.phone ?? c.email ?? ""}`,
          href: `/admin/customers?focus=${c.id}`,
        });
      }
      for (const s of sites.data ?? []) {
        next.push({
          id: `site:${s.id}`,
          kind: "site",
          label: s.name as string,
          sub: s.address as string,
          href: `/admin/sites/${s.id}`,
        });
      }
      for (const t of transactions.data ?? []) {
        next.push({
          id: `tx:${t.id}`,
          kind: "transaction",
          label: (t.reference as string) ?? "(no ref)",
          sub: `${t.type} · ${t.amount}`,
          href: `/admin/transactions?focus=${t.id}`,
        });
      }
      for (const d of disputes.data ?? []) {
        next.push({
          id: `dispute:${d.id}`,
          kind: "dispute",
          label: String(d.category ?? "dispute"),
          sub: String(d.description ?? "").slice(0, 80),
          href: `/admin/disputes/${d.id}`,
        });
      }
      for (const i of installations.data ?? []) {
        next.push({
          id: `install:${i.id}`,
          kind: "installation",
          label: (i.contract_number as string) ?? `Install ${String(i.id).slice(0, 8)}`,
          sub: String(i.stage),
          href: `/admin/installations/${i.id}`,
        });
      }
      setResults(next);
    }, 150);

    return () => clearTimeout(handle);
  }, [query, supabase]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-navy-950/40 pt-24 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <Command
        label="Global search"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-xl border border-navy-100 bg-white shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-navy-100 px-4">
          <Search className="h-4 w-4 text-navy-700/40" />
          <Command.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder="Search customers, sites, transactions, disputes…"
            className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-navy-700/40"
          />
          <kbd className="rounded bg-navy-100 px-1.5 py-0.5 text-[10px] font-mono text-navy-700/70">
            ESC
          </kbd>
        </div>
        <Command.List className="max-h-96 overflow-y-auto p-2">
          {query.length < 2 ? (
            <p className="px-3 py-6 text-center text-sm text-navy-700/40">
              Type at least 2 characters…
            </p>
          ) : results.length === 0 ? (
            <Command.Empty className="px-3 py-6 text-center text-sm text-navy-700/40">
              No matches
            </Command.Empty>
          ) : (
            results.map((r) => {
              const Icon = ICONS[r.kind];
              return (
                <Command.Item
                  key={r.id}
                  value={`${r.label} ${r.sub ?? ""}`}
                  onSelect={() => {
                    setOpen(false);
                    router.push(r.href);
                  }}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm data-[selected=true]:bg-yellow-500/10"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-navy-100 text-navy-700">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="flex-1">
                    <span className="block font-medium text-navy-950">
                      {r.label}
                    </span>
                    {r.sub ? (
                      <span className="block text-xs text-navy-700/60">
                        {r.sub}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-navy-700/40">
                    {r.kind}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-navy-700/40" />
                </Command.Item>
              );
            })
          )}
        </Command.List>
        <div className="flex items-center justify-between border-t border-navy-100 bg-offwhite px-4 py-2 text-[10px] uppercase tracking-wider text-navy-700/50">
          <span>
            <kbd className="font-mono">↑↓</kbd> navigate ·{" "}
            <kbd className="font-mono">↵</kbd> open
          </span>
          <span>
            <kbd className="font-mono">⌘K</kbd> toggle
          </span>
        </div>
      </Command>
    </div>
  );
}
