"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Wallet, LifeBuoy } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const navigation = [
  { name: "Home", href: "/host/home", icon: Home },
  { name: "Neighbors", href: "/host/neighbors", icon: Users },
  { name: "Earnings", href: "/host/earnings", icon: Wallet },
  { name: "Support", href: "/host/support", icon: LifeBuoy },
];

function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 z-50 w-full h-16 bg-white border-t border-navy-100 flex items-center justify-around px-2 pb-safe md:hidden">
      {navigation.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;

        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "relative flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
              isActive ? "text-navy-900" : "text-navy-300 hover:text-navy-500"
            )}
          >
            {isActive && (
              <div className="absolute top-0 h-0.5 w-8 bg-navy-900 rounded-full" />
            )}
            <Icon className={cn("h-5 w-5", isActive ? "stroke-[2.5px]" : "stroke-2")} />
            <span className="text-[10px] font-bold font-sans uppercase tracking-wider">
              {item.name}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export { BottomNav };
