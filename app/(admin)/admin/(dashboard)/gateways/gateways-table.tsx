"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/admin/data-table";
import { cn } from "@/lib/utils/cn";
import type { DerivedStatus, GatewayRow } from "./page";

const DOT: Record<DerivedStatus, string> = {
  online: "bg-green",
  offline: "bg-red",
  faulty: "bg-amber",
};

function StatusPill({ status }: { status: DerivedStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold capitalize">
      <span className={cn("h-2 w-2 rounded-full", DOT[status])} />
      {status}
    </span>
  );
}

type FilterValue = "all" | DerivedStatus;

export function GatewaysTable({ rows }: { rows: GatewayRow[] }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = React.useState<FilterValue>("all");

  const filtered = React.useMemo(() => {
    if (statusFilter === "all") return rows;
    return rows.filter((r) => r.derived_status === statusFilter);
  }, [rows, statusFilter]);

  const columns = React.useMemo<ColumnDef<GatewayRow>[]>(
    () => [
      { accessorKey: "serial_number", header: "Serial" },
      {
        accessorKey: "site_address",
        header: "Site",
        cell: ({ getValue }) => (
          <span className="max-w-[280px] truncate">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      { accessorKey: "host_name", header: "Host" },
      {
        accessorKey: "derived_status",
        header: "Status",
        cell: ({ getValue }) => (
          <StatusPill status={getValue() as DerivedStatus} />
        ),
      },
      {
        accessorKey: "firmware_version",
        header: "Firmware",
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">
            {(getValue() as string | null) ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "last_seen_at",
        header: "Last seen",
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          if (!v) return <span className="text-navy-700/60">never</span>;
          return (
            <span className="text-xs text-navy-700">
              {formatDistanceToNowStrict(new Date(v), { addSuffix: true })}
            </span>
          );
        },
      },
      {
        accessorKey: "meter_count",
        header: "Meters",
        cell: ({ getValue }) => (
          <span className="font-mono font-semibold">
            {Number(getValue() ?? 0)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      data={filtered}
      columns={columns}
      searchPlaceholder="Search serial, address…"
      exportFilename="gateways"
      onRowClick={(r) => router.push(`/admin/gateways/${r.id}`)}
      toolbar={
        <div className="flex items-center gap-2 text-sm">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as FilterValue)}
            className="h-9 rounded-lg border border-navy-200 bg-white px-2 text-sm font-medium text-navy-800"
          >
            <option value="all">All statuses</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="faulty">Faulty</option>
          </select>
        </div>
      }
    />
  );
}
