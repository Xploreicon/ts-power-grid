"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type RowSelectionState,
} from "@tanstack/react-table";
import {
  ChevronDown,
  ChevronUp,
  Download,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface DataTableProps<TData extends object> {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  /** Used for the built-in top-right quick filter. */
  searchPlaceholder?: string;
  /** Rows rendered when there's no data. */
  emptyState?: React.ReactNode;
  /** Row click handler (use for opening detail drawers). */
  onRowClick?: (row: TData) => void;
  /** Filename base (no extension) for CSV export. */
  exportFilename?: string;
  /** Extra toolbar content (filters etc) rendered left of the search box. */
  toolbar?: React.ReactNode;
  /** Bulk-action content rendered when >0 rows are selected. */
  bulkActions?: (selectedRows: TData[]) => React.ReactNode;
  /** Row ID extractor — required for selection to persist across pages. */
  getRowId?: (row: TData) => string;
  pageSize?: number;
}

/**
 * Thin wrapper around TanStack Table v8 with the batteries admin pages
 * want: search, sort, column visibility, pagination, CSV export, row
 * selection, bulk actions.
 *
 * Pagination/sorting/filtering are CLIENT-SIDE here. Move to server-side
 * by swapping `getPaginationRowModel` and feeding `manualPagination` +
 * onPaginationChange when a table outgrows this.
 */
export function DataTable<TData extends object>({
  data,
  columns,
  searchPlaceholder = "Search…",
  emptyState,
  onRowClick,
  exportFilename,
  toolbar,
  bulkActions,
  getRowId,
  pageSize = 25,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [showColumns, setShowColumns] = React.useState(false);

  const hasSelection = bulkActions != null;

  const wrappedColumns = React.useMemo<ColumnDef<TData, unknown>[]>(() => {
    if (!hasSelection) return columns;
    return [
      {
        id: "__select",
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            onClick={(e) => e.stopPropagation()}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 32,
      },
      ...columns,
    ];
  }, [columns, hasSelection]);

  const table = useReactTable({
    data,
    columns: wrappedColumns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
    enableRowSelection: hasSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
    initialState: { pagination: { pageSize } },
  });

  const selectedRows = table
    .getFilteredSelectedRowModel()
    .rows.map((r) => r.original);

  const exportCsv = () => {
    const visible = table.getVisibleLeafColumns().filter((c) => c.id !== "__select");
    const header = visible.map((c) => csvEscape(String(c.id)));
    const rows = table.getFilteredRowModel().rows.map((row) =>
      visible
        .map((col) => {
          const v = row.getValue(col.id);
          return csvEscape(v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));
        })
        .join(","),
    );
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportFilename ?? "export"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-2xl border border-navy-100 bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-navy-100 p-3">
        {toolbar}
        <div className="relative ml-auto flex items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-navy-700/40" />
          <input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-72 rounded-lg border border-navy-100 bg-offwhite py-1.5 pl-9 pr-3 text-sm outline-none focus:border-yellow-500 focus:bg-white"
          />
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColumns((v) => !v)}
            className="flex items-center gap-1 rounded-lg border border-navy-100 bg-white px-3 py-1.5 text-sm text-navy-700 hover:bg-offwhite"
          >
            <SlidersHorizontal className="h-4 w-4" /> Columns
          </button>
          {showColumns ? (
            <div className="absolute right-0 z-10 mt-1 w-56 rounded-lg border border-navy-100 bg-white p-2 shadow-lg">
              {table
                .getAllLeafColumns()
                .filter((c) => c.getCanHide())
                .map((col) => (
                  <label
                    key={col.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-offwhite"
                  >
                    <input
                      type="checkbox"
                      checked={col.getIsVisible()}
                      onChange={col.getToggleVisibilityHandler()}
                    />
                    <span className="truncate">{col.id}</span>
                  </label>
                ))}
            </div>
          ) : null}
        </div>
        {exportFilename ? (
          <button
            type="button"
            onClick={exportCsv}
            className="flex items-center gap-1 rounded-lg border border-navy-100 bg-white px-3 py-1.5 text-sm text-navy-700 hover:bg-offwhite"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        ) : null}
      </div>

      {/* Bulk actions bar */}
      {hasSelection && selectedRows.length > 0 ? (
        <div className="flex items-center gap-3 border-b border-navy-100 bg-yellow-500/10 px-4 py-2 text-sm">
          <span className="font-semibold">
            {selectedRows.length} selected
          </span>
          <div className="flex items-center gap-2">
            {bulkActions?.(selectedRows)}
          </div>
          <button
            type="button"
            onClick={() => table.resetRowSelection()}
            className="ml-auto text-navy-700 hover:underline"
          >
            Clear
          </button>
        </div>
      ) : null}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-offwhite text-xs font-bold uppercase tracking-wider text-navy-700/70">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const canSort = h.column.getCanSort();
                  const sort = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      style={{ width: h.getSize() !== 150 ? h.getSize() : undefined }}
                      className="whitespace-nowrap px-4 py-2.5"
                    >
                      {h.isPlaceholder ? null : (
                        <button
                          type="button"
                          onClick={h.column.getToggleSortingHandler()}
                          disabled={!canSort}
                          className={cn(
                            "inline-flex items-center gap-1",
                            canSort && "hover:text-navy-950",
                          )}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sort === "asc" ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : sort === "desc" ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : null}
                        </button>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={table.getAllLeafColumns().length}
                  className="px-4 py-12 text-center text-navy-700/60"
                >
                  {emptyState ?? "No rows to show."}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, idx) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  className={cn(
                    "border-t border-navy-100 transition-colors",
                    idx % 2 === 1 && "bg-offwhite/40",
                    onRowClick && "cursor-pointer hover:bg-yellow-500/5",
                    row.getIsSelected() && "bg-yellow-500/10",
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="whitespace-nowrap px-4 py-2.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-navy-100 px-4 py-2 text-sm text-navy-700/70">
        <div>
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {Math.max(table.getPageCount(), 1)} ·{" "}
          {table.getFilteredRowModel().rows.length} rows
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded-md border border-navy-100 px-2 py-1 disabled:opacity-40 hover:bg-offwhite"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="rounded-md border border-navy-100 px-2 py-1 disabled:opacity-40 hover:bg-offwhite"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function csvEscape(raw: string): string {
  if (raw.includes('"') || raw.includes(",") || raw.includes("\n")) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}
