"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import { NotificationCenter } from "@/components/admin/notification-center";

export function AdminTopbar({
  email,
  fullName,
  role,
}: {
  email: string | null;
  fullName: string | null;
  role: "admin" | "super_admin";
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");

  const initials = (fullName ?? email ?? "A?")
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-navy-100 bg-white px-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) {
            router.push(`/admin/search?q=${encodeURIComponent(query.trim())}`);
          }
        }}
        className="relative flex w-96 items-center"
      >
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-navy-700/40" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search customers, sites, references…"
          className="w-full rounded-lg border border-navy-100 bg-offwhite py-2 pl-9 pr-14 text-sm outline-none placeholder:text-navy-700/40 focus:border-yellow-500 focus:bg-white"
        />
        <kbd className="pointer-events-none absolute right-3 rounded bg-navy-100 px-1.5 py-0.5 font-mono text-[10px] text-navy-700/70">
          ⌘K
        </kbd>
      </form>

      <div className="ml-auto flex items-center gap-2">
        <NotificationCenter />

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left hover:border-navy-100"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-950 text-xs font-semibold text-yellow-500">
              {initials}
            </span>
            <span className="hidden text-sm font-medium text-navy-950 md:block">
              {fullName ?? email}
            </span>
            <span
              className={cn(
                "hidden rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider md:block",
                role === "super_admin"
                  ? "bg-yellow-500 text-navy-950"
                  : "bg-navy-100 text-navy-700",
              )}
            >
              {role === "super_admin" ? "Super" : "Admin"}
            </span>
          </button>
          {menuOpen ? (
            <div className="absolute right-0 mt-1 w-48 rounded-lg border border-navy-100 bg-white p-1 shadow-lg">
              <button
                type="button"
                onClick={async () => {
                  await createClient().auth.signOut();
                  router.push("/admin/sign-in");
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-navy-950 hover:bg-offwhite"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
