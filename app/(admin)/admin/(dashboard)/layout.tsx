import React from "react";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { AdminShell } from "@/components/admin/admin-shell";
import { SearchPalette } from "@/components/admin/search-palette";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();

  return (
    <>
      <AdminShell
        email={session.email}
        fullName={session.fullName}
      >
        {children}
      </AdminShell>
      <SearchPalette />
    </>
  );
}
