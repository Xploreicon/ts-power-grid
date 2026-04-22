"use client";

import { X } from "lucide-react";
import { format } from "date-fns";
import { StatusBadge } from "@/components/admin/status-badge";
import type { Lead } from "./page";

export function LeadDetailDrawer({
  lead,
  onClose,
}: {
  lead: Lead | null;
  onClose: () => void;
}) {
  if (!lead) return null;

  return (
    <div className="fixed inset-0 z-40 flex">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close drawer"
        className="flex-1 bg-navy-950/40"
      />
      <div className="flex w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-navy-100 p-5">
          <div>
            <div className="font-display text-xl font-semibold">{lead.name ?? "Unnamed"}</div>
            <div className="mt-1 flex items-center gap-2 text-sm text-navy-700/70">
              <StatusBadge status={lead.status} />
              <span>· created {format(new Date(lead.created_at), "d MMM yyyy")}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-navy-700 hover:bg-offwhite"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 text-sm">
          <dl className="grid grid-cols-[120px_1fr] gap-y-2">
            <dt className="text-navy-700/60">Phone</dt>
            <dd className="font-mono">{lead.phone ?? "—"}</dd>
            <dt className="text-navy-700/60">Email</dt>
            <dd>{lead.email ?? "—"}</dd>
            <dt className="text-navy-700/60">Area</dt>
            <dd>{lead.area ?? "—"}</dd>
            <dt className="text-navy-700/60">Path interest</dt>
            <dd>{(lead.path_interest ?? "—").replace(/_/g, " ")}</dd>
            <dt className="text-navy-700/60">Assigned to</dt>
            <dd className="font-mono text-xs">{lead.assigned_to ?? "—"}</dd>
          </dl>
          {lead.notes ? (
            <section className="mt-6">
              <h3 className="mb-1 text-xs font-bold uppercase tracking-widest text-navy-700/60">
                Notes
              </h3>
              <p className="whitespace-pre-wrap rounded-lg bg-offwhite p-3 text-navy-950">
                {lead.notes}
              </p>
            </section>
          ) : null}
          <section className="mt-6">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-navy-700/60">
              Actions
            </h3>
            <div className="space-y-2">
              <button className="w-full rounded-lg bg-navy-950 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800">
                Assign to me
              </button>
              <button className="w-full rounded-lg border border-navy-100 px-4 py-2 text-sm font-semibold hover:bg-offwhite">
                Update status
              </button>
              <button className="w-full rounded-lg border border-yellow-500 bg-yellow-500/10 px-4 py-2 text-sm font-semibold text-navy-950 hover:bg-yellow-500/20">
                Convert to customer
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
