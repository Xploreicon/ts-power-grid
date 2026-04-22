"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, LogOut, Menu } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { NotificationCenter } from "@/components/admin/notification-center";

export function AdminTopbar({
  email,
  fullName,
  onMenuToggle,
}: {
  email: string | null;
  fullName: string | null;
  onMenuToggle?: () => void;
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
    <header className="sticky top-0 z-30 flex h-14 items-center border-b border-navy-100 bg-white/80 backdrop-blur-md px-4 lg:px-6">
      {/* Mobile Hamburger */}
      <button
        type="button"
        onClick={onMenuToggle}
        className="mr-3 flex h-10 w-10 items-center justify-center rounded-lg text-navy-700 hover:bg-offwhite lg:hidden"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Brand - Mobile Only */}
      <div className="flex flex-1 items-center gap-2 lg:hidden">
        <span className="font-display text-base font-bold tracking-tight text-navy-950">
          T&S <span className="text-yellow-600">Admin</span>
        </span>
      </div>

      {/* Search - Desktop / Semi-hidden on Mobile */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) {
            router.push(`/admin/search?q=${encodeURIComponent(query.trim())}`);
          }
        }}
        className="relative hidden flex-1 items-center lg:flex lg:max-w-96"
      >
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-navy-700/40" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="w-full rounded-lg border border-navy-100 bg-offwhite py-2 pl-9 pr-14 text-sm outline-none placeholder:text-navy-700/40 focus:border-yellow-500 focus:bg-white"
        />
        <kbd className="pointer-events-none absolute right-3 hidden rounded bg-navy-100 px-1.5 py-0.5 font-mono text-[10px] text-navy-700/70 lg:block">
          ⌘K
        </kbd>
      </form>

      <div className="ml-auto flex items-center gap-1 lg:gap-2">
        <button
          className="flex h-10 w-10 items-center justify-center rounded-lg text-navy-700 hover:bg-offwhite lg:hidden"
          onClick={() => router.push("/admin/search")}
        >
          <Search className="h-5 w-5" />
        </button>
        
        <NotificationCenter />

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg border border-transparent px-1 py-1.5 text-left hover:border-navy-100 lg:px-2"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-950 text-xs font-semibold text-yellow-500">
              {initials}
            </span>
            <span className="hidden text-sm font-medium text-navy-950 lg:block">
              {fullName ?? email}
            </span>
          </button>
          {menuOpen ? (
            <div className="absolute right-0 mt-1 w-48 rounded-lg border border-navy-100 bg-white p-1 shadow-lg">
              <div className="border-b border-navy-50 px-3 py-2 lg:hidden">
                <p className="truncate text-xs font-bold text-navy-950">{fullName ?? "Admin"}</p>
                <p className="truncate text-[10px] text-navy-500">{email}</p>
              </div>
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
