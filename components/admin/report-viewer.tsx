"use client";

import * as React from "react";
import { Download, Printer, Mail } from "lucide-react";
import { toast } from "sonner";

/**
 * Wraps a report page in a consistent shell with toolbar + date-range
 * inputs + export actions. PDF export uses window.print() targeting a
 * print stylesheet — keeps us off heavyweight react-pdf in v1. CSV export
 * is handled by the `csvRows` callback.
 */
export function ReportViewer({
  title,
  description,
  defaultRange,
  onRangeChange,
  csvRows,
  emailEnabled,
  children,
}: {
  title: string;
  description?: string;
  defaultRange?: { from: string; to: string };
  onRangeChange?: (range: { from: string; to: string }) => void;
  csvRows?: () => { filename: string; rows: (string | number)[][] };
  emailEnabled?: boolean;
  children: React.ReactNode;
}) {
  const [from, setFrom] = React.useState(
    defaultRange?.from ??
      new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10),
  );
  const [to, setTo] = React.useState(
    defaultRange?.to ?? new Date().toISOString().slice(0, 10),
  );

  React.useEffect(() => {
    onRangeChange?.({ from, to });
  }, [from, to, onRangeChange]);

  const exportCsv = () => {
    if (!csvRows) return;
    const { filename, rows } = csvRows();
    const csv = rows
      .map((r) => r.map((cell) => csvEscape(String(cell))).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">{title}</h1>
          {description ? (
            <p className="text-sm text-navy-700/70">{description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-sm text-navy-700/60">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-navy-100 bg-white px-2 py-1"
            />
          </label>
          <label className="flex items-center gap-1 text-sm text-navy-700/60">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-navy-100 bg-white px-2 py-1"
            />
          </label>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1 rounded-lg border border-navy-100 bg-white px-3 py-1.5 text-sm font-semibold"
          >
            <Printer className="h-4 w-4" /> PDF
          </button>
          {csvRows ? (
            <button
              type="button"
              onClick={exportCsv}
              className="flex items-center gap-1 rounded-lg border border-navy-100 bg-white px-3 py-1.5 text-sm font-semibold"
            >
              <Download className="h-4 w-4" /> CSV
            </button>
          ) : null}
          {emailEnabled ? (
            <button
              type="button"
              onClick={() => toast.info("Stakeholder-email form — TODO")}
              className="flex items-center gap-1 rounded-lg border border-navy-100 bg-white px-3 py-1.5 text-sm font-semibold"
            >
              <Mail className="h-4 w-4" /> Email
            </button>
          ) : null}
        </div>
      </div>
      <div className="rounded-2xl border border-navy-100 bg-white p-5 print:border-0 print:p-0">
        {children}
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
