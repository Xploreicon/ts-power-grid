"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatNgnKobo } from "@/lib/admin/format";
import type { SiteRow } from "./page";

export function SitesTable({ rows }: { rows: SiteRow[] }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");

  const filtered = React.useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (typeFilter !== "all" && r.installation_type !== typeFilter) return false;
      return true;
    });
  }, [rows, statusFilter, typeFilter]);

  const columns = React.useMemo<ColumnDef<SiteRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Site",
        cell: ({ row }) =>
          row.original.name ?? (
            <span className="text-navy-700/50">—</span>
          ),
      },
      { accessorKey: "host_name", header: "Host" },
      { accessorKey: "address", header: "Address" },
      {
        accessorKey: "installation_type",
        header: "Type",
        cell: ({ getValue }) => (
          <span className="capitalize">
            {String(getValue() ?? "—").replace(/_/g, " ")}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
      },
      {
        accessorKey: "installed_at",
        header: "Installed",
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return v ? format(new Date(v), "d MMM yyyy") : "—";
        },
      },
      {
        accessorKey: "active_neighbors",
        header: "Active neighbors",
        cell: ({ getValue }) => (
          <span className="font-mono font-semibold">{Number(getValue() ?? 0)}</span>
        ),
      },
      {
        accessorKey: "revenue_month_kobo",
        header: "Revenue (MTD)",
        cell: ({ getValue }) => (
          <span className="font-mono">{formatNgnKobo(Number(getValue() ?? 0))}</span>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      data={filtered}
      columns={columns}
      searchPlaceholder="Search host, address…"
      exportFilename="sites"
      onRowClick={(r) => router.push(`/admin/sites/${r.id}`)}
      toolbar={
        <div className="flex items-center gap-2 text-sm">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-navy-100 bg-white px-2 py-1.5"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="installing">Installing</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="decommissioned">Decommissioned</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-navy-100 bg-white px-2 py-1.5"
          >
            <option value="all">All types</option>
            <option value="full_stack">Full Stack</option>
            <option value="upgrade">Upgrade Kit</option>
          </select>
        </div>
      }
    />
  );
}
