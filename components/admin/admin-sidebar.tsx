"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  ScrollText,
  MessageSquareWarning,
  Wrench,
  PackageSearch,
  FileBarChart,
  Settings,
  Contact,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/leads", label: "Leads", icon: Contact },
  { href: "/admin/sites", label: "Sites", icon: Building2 },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/transactions", label: "Transactions", icon: ScrollText },
  { href: "/admin/disputes", label: "Disputes", icon: MessageSquareWarning },
  { href: "/admin/installations", label: "Installations", icon: Wrench },
  { href: "/admin/inventory", label: "Inventory", icon: PackageSearch },
  { href: "/admin/reports", label: "Reports", icon: FileBarChart },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/audit", label: "Audit Log", icon: ShieldCheck },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-navy-800 bg-navy-950 text-white">
      <div className="flex h-14 items-center gap-2 border-b border-navy-800 px-5">
        <Zap className="h-5 w-5 text-yellow-500" />
        <span className="font-display text-lg font-semibold tracking-tight">
          T&S <span className="text-yellow-500">Admin</span>
        </span>
      </div>
      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {NAV.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-navy-800 text-yellow-500"
                      : "text-white/70 hover:bg-navy-800/60 hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-navy-800 p-3 text-xs text-white/40">
        v1.0 · Internal only
      </div>
    </aside>
  );
}
