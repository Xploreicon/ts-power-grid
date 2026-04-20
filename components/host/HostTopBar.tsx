"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useUser } from "@/lib/hooks/useUser";

export function HostTopBar() {
  const profile = useUser();
  const initials =
    profile?.full_name
      ?.split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ?? "H";

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-navy-950 z-40 flex items-center justify-between px-4 md:px-6 border-b border-navy-900">
      <Link href="/host/home" className="flex items-center gap-2.5">
        <span className="font-display font-bold text-white text-xl leading-none">
          T<span className="text-yellow-400">&amp;</span>S
        </span>
        <span className="text-navy-400 text-[11px] font-mono uppercase tracking-widest hidden sm:block">
          Power Grid
        </span>
      </Link>

      <div className="flex items-center gap-1">
        <button
          aria-label="Notifications"
          className="relative p-2.5 text-navy-400 hover:text-white rounded-full hover:bg-navy-800 transition-colors"
        >
          <Bell className="h-5 w-5" />
        </button>
        <Link
          href="/host/settings"
          aria-label="Settings"
          className="h-8 w-8 rounded-full bg-yellow-500 flex items-center justify-center text-navy-950 text-xs font-bold hover:bg-yellow-400 transition-colors"
        >
          {initials}
        </Link>
      </div>
    </header>
  );
}
