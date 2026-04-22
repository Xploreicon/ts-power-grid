"use client";

import * as React from "react";
import { format } from "date-fns";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatNgnKobo } from "@/lib/admin/format";
import type { CustomerRow } from "./page";

export function CustomersTable({ rows }: { rows: CustomerRow[] }) {
  const [roleFilter, setRoleFilter] = React.useState<"all" | "host" | "neighbor">("all");
  const [kycFilter, setKycFilter] = React.useState("all");

  const filtered = React.useMemo(
    () =>
      rows.filter((r) => {
        if (roleFilter !== "all" && r.role !== roleFilter) return false;
        if (kycFilter !== "all" && r.kyc_status !== kycFilter) return false;
        return true;
      }),
    [rows, roleFilter, kycFilter],
  );

  const columns = React.useMemo<ColumnDef<CustomerRow>[]>(
    () => [
      { accessorKey: "full_name", header: "Name" },
      { accessorKey: "phone", header: "Phone" },
      {
        accessorKey: "role",
        header: "Type",
        cell: ({ getValue }) => (
          <span className="rounded-md bg-navy-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-navy-700">
            {String(getValue())}
          </span>
        ),
      },
      {
        accessorKey: "kyc_status",
        header: "KYC",
        cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
      },
      {
        accessorKey: "created_at",
        header: "Registered",
        cell: ({ getValue }) =>
          format(new Date(getValue() as string), "d MMM yyyy"),
      },
      {
        accessorKey: "wallet_balance_kobo",
        header: "Wallet",
        cell: ({ getValue }) => (
          <span className="font-mono">
            {formatNgnKobo(Number(getValue() ?? 0))}
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
      searchPlaceholder="Search name, phone, email…"
      exportFilename="customers"
      getRowId={(r) => r.id}
      bulkActions={(sel) => (
        <button
          type="button"
          onClick={() => alert(`Verify KYC for ${sel.length} users — TODO`)}
          className="rounded-md bg-navy-950 px-3 py-1 text-xs font-semibold text-white"
        >
          Verify KYC
        </button>
      )}
      toolbar={
        <div className="flex items-center gap-2 text-sm">
          <select
            value={roleFilter}
            onChange={(e) =>
              setRoleFilter(e.target.value as "all" | "host" | "neighbor")
            }
            className="rounded-lg border border-navy-100 bg-white px-2 py-1.5"
          >
            <option value="all">All roles</option>
            <option value="host">Hosts</option>
            <option value="neighbor">Neighbors</option>
          </select>
          <select
            value={kycFilter}
            onChange={(e) => setKycFilter(e.target.value)}
            className="rounded-lg border border-navy-100 bg-white px-2 py-1.5"
          >
            <option value="all">Any KYC</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      }
    />
  );
}
