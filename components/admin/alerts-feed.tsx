import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { AlertTriangle } from "lucide-react";

export function AlertsFeed({
  alerts,
}: {
  alerts: { id: string; kind: string; title: string; body: string; at: string; href?: string }[];
}) {
  if (!alerts.length) {
    return (
      <p className="text-sm text-navy-700/60">No alerts right now. 🎉</p>
    );
  }
  return (
    <ul className="space-y-3">
      {alerts.map((a) => {
        const body = (
          <div className="flex gap-3">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber/10 text-amber">
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-semibold text-navy-950">
                  {a.title}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-navy-700/60">
                  {formatDistanceToNowStrict(new Date(a.at), {
                    addSuffix: true,
                  })}
                </span>
              </div>
              {a.body ? (
                <p className="line-clamp-2 text-xs text-navy-700/70">{a.body}</p>
              ) : null}
            </div>
          </div>
        );
        return (
          <li key={a.id}>
            {a.href ? (
              <Link
                href={a.href}
                className="block rounded-lg p-2 hover:bg-offwhite"
              >
                {body}
              </Link>
            ) : (
              <div className="p-2">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
