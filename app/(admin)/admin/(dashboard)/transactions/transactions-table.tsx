"use client";

import * as React from "react";
import { format } from "date-fns";
import { X } from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatNgnKobo } from "@/lib/admin/format";
import type { TransactionRow } from "./page";

export function TransactionsTable({ rows }: { rows: TransactionRow[] }) {
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [detail, setDetail] = React.useState<TransactionRow | null>(null);

  const filtered = React.useMemo(
    () =>
      rows.filter((r) => {
        if (typeFilter !== "all" && r.type !== typeFilter) return false;
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        return true;
      }),
    [rows, typeFilter, statusFilter],
  );

  const columns = React.useMemo<ColumnDef<TransactionRow>[]>(
    () => [
      {
        accessorKey: "created_at",
        header: "Time",
        cell: ({ getValue }) =>
          format(new Date(getValue() as string), "d MMM HH:mm"),
      },
      {
        accessorKey: "user_name",
        header: "User",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.user_name ?? "—"}</div>
            <div className="font-mono text-xs text-navy-700/60">
              {row.original.user_phone ?? ""}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ getValue }) => (
          <span className="capitalize">
            {String(getValue()).replace(/_/g, " ")}
          </span>
        ),
      },
      {
        accessorKey: "amount_kobo",
        header: "Amount",
        cell: ({ getValue }) => (
          <span className="font-mono">
            {formatNgnKobo(Number(getValue() ?? 0))}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
      },
      {
        accessorKey: "reference",
        header: "Reference",
        cell: ({ getValue }) => (
          <code className="text-xs text-navy-700">
            {String(getValue() ?? "—").slice(0, 20)}
          </code>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <DataTable
        data={filtered}
        columns={columns}
        searchPlaceholder="Search user, reference…"
        exportFilename="transactions"
        onRowClick={setDetail}
        toolbar={
          <div className="flex items-center gap-2 text-sm">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-navy-100 bg-white px-2 py-1.5"
            >
              <option value="all">All types</option>
              <option value="topup">Top-up</option>
              <option value="consumption">Consumption</option>
              <option value="withdrawal">Withdrawal</option>
              <option value="platform_fee">Platform fee</option>
              <option value="installment">Installment</option>
              <option value="refund">Refund</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-navy-100 bg-white px-2 py-1.5"
            >
              <option value="all">Any status</option>
              <option value="pending">Pending</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        }
      />
      {detail ? (
        <TransactionDetailModal row={detail} onClose={() => setDetail(null)} />
      ) : null}
    </>
  );
}

function TransactionDetailModal({
  row,
  onClose,
}: {
  row: TransactionRow;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-navy-950/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-navy-100 p-5">
          <div>
            <div className="text-xs uppercase tracking-widest text-navy-700/60">
              Transaction
            </div>
            <div className="font-mono text-xs text-navy-700">{row.id}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-navy-700 hover:bg-offwhite"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <dl className="grid grid-cols-[140px_1fr] gap-y-2 p-5 text-sm">
          <dt className="text-navy-700/60">Type</dt>
          <dd className="capitalize">{row.type.replace(/_/g, " ")}</dd>
          <dt className="text-navy-700/60">Amount</dt>
          <dd className="font-mono font-semibold">
            {formatNgnKobo(row.amount_kobo)}
          </dd>
          <dt className="text-navy-700/60">Status</dt>
          <dd><StatusBadge status={row.status} /></dd>
          <dt className="text-navy-700/60">User</dt>
          <dd>
            {row.user_name}{" "}
            <span className="font-mono text-xs text-navy-700/60">
              {row.user_phone}
            </span>
          </dd>
          <dt className="text-navy-700/60">Time</dt>
          <dd className="font-mono text-xs">
            {format(new Date(row.created_at), "d MMM yyyy HH:mm:ss")}
          </dd>
          <dt className="text-navy-700/60">Reference</dt>
          <dd className="break-all font-mono text-xs">{row.reference ?? "—"}</dd>
        </dl>
      </div>
    </div>
  );
}
