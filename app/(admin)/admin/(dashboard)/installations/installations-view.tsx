"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { type ColumnDef } from "@tanstack/react-table";
import { KanbanBoard } from "@/components/admin/kanban-board";
import { DataTable } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatNgnKobo } from "@/lib/admin/format";
import { cn } from "@/lib/utils/cn";
import { STAGES, type InstallationRow } from "./types";

export function InstallationsView({ rows }: { rows: InstallationRow[] }) {
  const router = useRouter();
  const [view, setView] = React.useState<"kanban" | "list">("kanban");
  const [pathFilter, setPathFilter] = React.useState("all");
  const [areaFilter, setAreaFilter] = React.useState("all");
  const [techFilter, setTechFilter] = React.useState("all");

  const areas = Array.from(
    new Set(rows.map((r) => r.area).filter((a): a is string => !!a)),
  );
  const techs = Array.from(
    new Set(
      rows
        .map((r) => r.assigned_technician)
        .filter((a): a is string => !!a),
    ),
  );

  const filtered = rows.filter((r) => {
    if (pathFilter !== "all" && r.path_type !== pathFilter) return false;
    if (areaFilter !== "all" && r.area !== areaFilter) return false;
    if (techFilter !== "all" && r.assigned_technician !== techFilter) return false;
    return true;
  });

  const moveStage = async (id: string, toStage: string) => {
    toast.loading("Updating stage…", { id });
    const res = await fetch(`/api/admin/installations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: toStage }),
    });
    if (res.ok) {
      toast.success("Stage updated", { id });
      router.refresh();
    } else {
      toast.error("Failed to update", { id });
    }
  };

  const cards = filtered.map((r) => ({
    id: r.id,
    stage: r.stage,
    title: r.customer_name ?? "Unnamed",
    subtitle: `${r.path_type?.replace(/_/g, " ") ?? "—"} · ${r.area ?? "—"}`,
    meta: r.amount_kobo ? formatNgnKobo(r.amount_kobo) : undefined,
    ageDays: differenceInDays(new Date(), new Date(r.updated_at)),
    href: `/admin/installations/${r.id}`,
  }));

  const listColumns = React.useMemo<ColumnDef<InstallationRow>[]>(
    () => [
      { accessorKey: "customer_name", header: "Customer" },
      {
        accessorKey: "path_type",
        header: "Path",
        cell: ({ getValue }) => (
          <span className="capitalize">
            {String(getValue() ?? "—").replace(/_/g, " ")}
          </span>
        ),
      },
      { accessorKey: "area", header: "Area" },
      {
        accessorKey: "stage",
        header: "Stage",
        cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
      },
      {
        accessorKey: "scheduled_at",
        header: "Scheduled",
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return v ? format(new Date(v), "d MMM yyyy") : "—";
        },
      },
      {
        accessorKey: "assigned_technician",
        header: "Technician",
        cell: ({ getValue }) => String(getValue() ?? "—").slice(0, 12),
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
    ],
    [],
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-navy-100 bg-white p-0.5">
          {(["kanban", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-semibold capitalize transition-colors",
                view === v
                  ? "bg-navy-950 text-white"
                  : "text-navy-700 hover:bg-offwhite",
              )}
            >
              {v}
            </button>
          ))}
        </div>
        <select
          value={pathFilter}
          onChange={(e) => setPathFilter(e.target.value)}
          className="rounded-lg border border-navy-100 bg-white px-2 py-1.5 text-sm"
        >
          <option value="all">All paths</option>
          <option value="full_stack">Full Stack</option>
          <option value="upgrade">Upgrade Kit</option>
        </select>
        <select
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
          className="rounded-lg border border-navy-100 bg-white px-2 py-1.5 text-sm"
        >
          <option value="all">All areas</option>
          {areas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          value={techFilter}
          onChange={(e) => setTechFilter(e.target.value)}
          className="rounded-lg border border-navy-100 bg-white px-2 py-1.5 text-sm"
        >
          <option value="all">All technicians</option>
          {techs.map((t) => (
            <option key={t} value={t}>
              {t.slice(0, 10)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => toast.info("New-installation form — TODO")}
          className="ml-auto rounded-lg bg-yellow-500 px-3 py-1.5 text-sm font-bold text-navy-950 hover:bg-yellow-400"
        >
          + New installation
        </button>
      </div>

      {view === "kanban" ? (
        <KanbanBoard
          columns={STAGES.map((s) => ({ id: s.id, title: s.title }))}
          cards={cards}
          onMove={moveStage}
          onCardClick={(c) => router.push(`/admin/installations/${c.id}`)}
        />
      ) : (
        <DataTable
          data={filtered}
          columns={listColumns}
          searchPlaceholder="Search customer, area…"
          exportFilename="installations"
          onRowClick={(r) => router.push(`/admin/installations/${r.id}`)}
        />
      )}
    </>
  );
}
