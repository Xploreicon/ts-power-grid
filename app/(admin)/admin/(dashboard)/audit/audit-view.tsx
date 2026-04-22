"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield } from "lucide-react";

type AuditEvent = {
  id: string;
  event_type: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  metadata: unknown;
  created_at: string;
};

export function AuditView({ events }: { events: AuditEvent[] }) {
  const router = useRouter();
  const search = useSearchParams();
  const eventFilter = search.get("event") ?? "";
  const actorFilter = search.get("actor") ?? "";
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const uniqueEvents = Array.from(new Set(events.map((e) => e.event_type))).sort();

  function push(next: Record<string, string | null>) {
    const params = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    router.replace(`/admin/audit?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
            <Shield className="h-5 w-5 text-yellow-500" />
            Audit log
          </h1>
          <p className="text-sm text-navy-700/70">
            All admin-authored mutations. Most recent 500 events. Super admin
            only.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-navy-100 bg-white p-3">
        <select
          value={eventFilter}
          onChange={(e) => push({ event: e.target.value || null })}
          className="rounded-lg border border-navy-100 bg-white px-3 py-1.5 text-sm"
        >
          <option value="">All events</option>
          {uniqueEvents.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          defaultValue={actorFilter}
          placeholder="Actor UUID"
          onBlur={(e) => push({ actor: e.target.value || null })}
          className="w-72 rounded-lg border border-navy-100 bg-white px-3 py-1.5 font-mono text-xs"
        />
        {eventFilter || actorFilter ? (
          <button
            type="button"
            onClick={() => router.replace("/admin/audit")}
            className="rounded-lg border border-navy-100 bg-white px-3 py-1.5 text-sm font-semibold"
          >
            Clear
          </button>
        ) : null}
        <span className="ml-auto self-center text-xs text-navy-700/60">
          {events.length} events
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-offwhite">
            <tr className="text-left text-xs uppercase tracking-wider text-navy-700/60">
              <th className="px-4 py-2">Time</th>
              <th>Event</th>
              <th>Actor</th>
              <th className="pr-4 text-right">Detail</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-navy-700/40">
                  No matching audit events.
                </td>
              </tr>
            ) : (
              events.map((e) => (
                <React.Fragment key={e.id}>
                  <tr
                    className="cursor-pointer border-t border-navy-100 hover:bg-offwhite"
                    onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                  >
                    <td className="px-4 py-2 font-mono text-xs text-navy-700/60">
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                    <td className="py-2">
                      <code className="rounded bg-navy-100 px-1.5 py-0.5 text-xs">
                        {e.event_type}
                      </code>
                    </td>
                    <td className="py-2">
                      <span className="font-medium">
                        {e.actor_name ?? e.actor_email ?? "system"}
                      </span>
                    </td>
                    <td className="pr-4 text-right text-xs text-navy-700/60">
                      {expanded === e.id ? "Hide" : "View"}
                    </td>
                  </tr>
                  {expanded === e.id ? (
                    <tr className="border-t border-navy-100 bg-navy-950">
                      <td colSpan={4} className="p-4">
                        <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-yellow-500">
                          {JSON.stringify(e.metadata, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
