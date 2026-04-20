import React from "react";
import { HostTopBar } from "@/components/host/HostTopBar";
import { HostSidebar } from "@/components/host/HostSidebar";
import { BottomNav } from "@/components/ui";

export default function HostLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-offwhite">
      {/* Fixed top bar — shared across all host pages */}
      <HostTopBar />

      {/* Desktop sidebar */}
      <HostSidebar className="hidden md:flex" />

      {/* Main content: offset for top bar (pt-14) + bottom nav on mobile (pb-20) */}
      <main className="pt-14 pb-20 md:pb-0 md:pl-64 min-h-screen">
        {children}
      </main>

      {/* Mobile bottom tab bar */}
      <BottomNav />
    </div>
  );
}
