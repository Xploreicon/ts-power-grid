"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Wallet, LifeBuoy, Settings } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const navigation = [
  { name: "Home", href: "/host/home", icon: Home },
  { name: "Neighbors", href: "/host/neighbors", icon: Users },
  { name: "Earnings", href: "/host/earnings", icon: Wallet },
  { name: "Support", href: "/host/support", icon: LifeBuoy },
  { name: "Settings", href: "/host/settings", icon: Settings },
];

export function HostSidebar({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed top-14 left-0 w-64 bottom-0 bg-white border-r border-navy-100 flex-col",
        className,
      )}
    >
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/host/home" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-colors",
                isActive
                  ? "bg-navy-950 text-white"
                  : "text-navy-500 hover:bg-navy-50 hover:text-navy-900",
              )}
            >
              <Icon className="h-[18px] w-[18px] flex-shrink-0" />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-4 border-t border-navy-100">
        <p className="text-[10px] font-mono uppercase tracking-widest text-navy-300">
          T&amp;S Power Grid
        </p>
        <p className="text-[10px] text-navy-400 mt-0.5">Host Portal v0.1</p>
      </div>
    </aside>
  );
}
