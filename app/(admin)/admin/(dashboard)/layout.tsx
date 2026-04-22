import React from "react";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import { SearchPalette } from "@/components/admin/search-palette";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();

  return (
    <div className="min-h-screen bg-offwhite text-navy-950">
      <AdminSidebar />
      <div className="pl-60">
        <AdminTopbar
          email={session.email}
          fullName={session.fullName}
          role={session.role}
        />
        <main className="p-6">{children}</main>
      </div>
      <SearchPalette />
    </div>
  );
}
