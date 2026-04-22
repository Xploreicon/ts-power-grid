"use client";

import { useState } from "react";
import { AdminSidebar } from "./admin-sidebar";
import { AdminTopbar } from "./admin-topbar";

export function AdminShell({
  children,
  email,
  fullName,
}: {
  children: React.ReactNode;
  email: string | null;
  fullName: string | null;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-offwhite text-navy-950">
      <AdminSidebar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />
      <div className="flex flex-col lg:pl-60 min-h-screen transition-all duration-300">
        <AdminTopbar
          email={email}
          fullName={fullName}
          onMenuToggle={() => setIsMobileMenuOpen((v) => !v)}
        />
        <main className="p-4 lg:p-6 flex-1 w-full max-w-full overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
