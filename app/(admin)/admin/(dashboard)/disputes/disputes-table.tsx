"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import type { DisputeRow } from "./page";

export function DisputesTable({ rows }: { rows: DisputeRow[] }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = React.useState<"all" | "open" | "other">(
    "open",
  );

  const filtered = React.useMemo(() => {
    if (statusFilter === "all") return rows;
    if (statusFilter === "open") return rows.filter((r) => r.status === "open");
    return rows.filter((r) => r.status !== "open");
  }, [rows, statusFilter]);

  const columns = React.useMemo<ColumnDef<DisputeRow>[]>(
    () => [
      {
        accessorKey: "raised_by_name",
        header: "Raised by",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">
              {row.original.raised_by_name ?? "—"}
            </div>
            <div className="font-mono text-xs text-navy-700/60">
              {row.original.raised_by_phone ?? ""}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "category",
        header: "Category",
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
        accessorKey: "created_at",
        header: "Created",
        cell: ({ getValue }) =>
          format(new Date(getValue() as string), "d MMM HH:mm"),
      },
      {
        accessorKey: "assigned_to",
        header: "Assigned",
        cell: ({ getValue }) => (
          <code className="font-mono text-xs">
            {String(getValue() ?? "—").slice(0, 8)}
          </code>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      data={filtered}
      columns={columns}
      searchPlaceholder="Search description…"
      exportFilename="disputes"
      onRowClick={(r) => router.push(`/admin/disputes/${r.id}`)}
      toolbar={
        <div className="flex items-center gap-2 text-sm">
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "all" | "open" | "other")
            }
            className="rounded-lg border border-navy-100 bg-white px-2 py-1.5"
          >
            <option value="open">Open</option>
            <option value="other">Closed</option>
            <option value="all">All</option>
          </select>
        </div>
      }
    />
  );
}
