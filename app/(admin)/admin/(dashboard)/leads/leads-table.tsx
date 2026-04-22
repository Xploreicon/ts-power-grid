"use client";

import * as React from "react";
import { format } from "date-fns";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import type { Lead } from "./page";
import { LeadDetailDrawer } from "./lead-detail-drawer";

export function LeadsTable({ leads }: { leads: Lead[] }) {
  const [selected, setSelected] = React.useState<Lead | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [pathFilter, setPathFilter] = React.useState<string>("all");

  const filtered = React.useMemo(() => {
    return leads.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (pathFilter !== "all" && l.path_interest !== pathFilter) return false;
      return true;
    });
  }, [leads, statusFilter, pathFilter]);

  const columns = React.useMemo<ColumnDef<Lead>[]>(
    () => [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "phone", header: "Phone" },
      { accessorKey: "area", header: "Area" },
      {
        accessorKey: "path_interest",
        header: "Path",
        cell: ({ getValue }) => (
          <span className="font-medium">
            {String(getValue() ?? "—").replace(/_/g, " ")}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
      },
      { accessorKey: "assigned_to", header: "Assigned", cell: ({ getValue }) => String(getValue() ?? "—").slice(0, 8) },
      {
        accessorKey: "created_at",
        header: "Created",
        cell: ({ getValue }) =>
          format(new Date(getValue() as string), "d MMM yyyy"),
      },
    ],
    [],
  );

  return (
    <>
      <DataTable
        data={filtered}
        columns={columns}
        searchPlaceholder="Search name, phone, email…"
        exportFilename="leads"
        onRowClick={setSelected}
        getRowId={(r) => r.id}
        bulkActions={(rows) => (
          <>
            <button
              type="button"
              onClick={() => alert(`Assign ${rows.length} to me — TODO`)}
              className="rounded-md bg-navy-950 px-3 py-1 text-xs font-semibold text-white"
            >
              Assign to me
            </button>
          </>
        )}
        toolbar={
          <div className="flex items-center gap-2 text-sm">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-navy-100 bg-white px-2 py-1.5"
            >
              <option value="all">All statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="converted">Converted</option>
              <option value="rejected">Rejected</option>
            </select>
            <select
              value={pathFilter}
              onChange={(e) => setPathFilter(e.target.value)}
              className="rounded-lg border border-navy-100 bg-white px-2 py-1.5"
            >
              <option value="all">All paths</option>
              <option value="full_stack">Full Stack</option>
              <option value="upgrade">Upgrade Kit</option>
              <option value="neighbor">Neighbor</option>
            </select>
          </div>
        }
      />
      <LeadDetailDrawer
        lead={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
