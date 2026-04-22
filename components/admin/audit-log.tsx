import { format } from "date-fns";

export interface AuditEvent {
  id: string;
  type: string;
  at: string | Date;
  actor?: string;
  summary?: string;
  details?: Record<string, unknown>;
}

/**
 * Vertical timeline. Use for per-site activity, dispute history, etc.
 * Renders latest first — pass events already ordered.
 */
export function AuditLog({ events }: { events: AuditEvent[] }) {
  if (!events.length) {
    return (
      <div className="rounded-xl border border-dashed border-navy-100 p-6 text-center text-sm text-navy-700/60">
        No activity recorded yet.
      </div>
    );
  }
  return (
    <ol className="relative space-y-4 border-l border-navy-100 pl-6">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[31px] top-1.5 flex h-2.5 w-2.5 rounded-full bg-yellow-500 ring-4 ring-white" />
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-xs text-navy-700/70">
              {format(new Date(e.at), "d MMM HH:mm")}
            </span>
            <span className="font-semibold text-navy-950">
              {e.type.replace(/_/g, " ")}
            </span>
            {e.actor ? (
              <span className="text-xs text-navy-700/70">· {e.actor}</span>
            ) : null}
          </div>
          {e.summary ? (
            <div className="mt-1 text-sm text-navy-700">{e.summary}</div>
          ) : null}
          {e.details ? (
            <pre className="mt-2 overflow-x-auto rounded-md bg-offwhite p-2 font-mono text-[11px] text-navy-700">
              {JSON.stringify(e.details, null, 2)}
            </pre>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
