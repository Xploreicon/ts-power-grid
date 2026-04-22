/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
"use client";

import * as React from "react";
import { toast } from "sonner";
import { type EventType } from "@/lib/notifications/types";

const EVENTS: EventType[] = [
  "neighbor_topup_received",
  "daily_earnings_summary",
  "system_health_alert",
  "installment_due_reminder",
  "withdrawal_confirmation",
  "welcome_connection",
  "low_balance_warning",
  "system_fault_reported",
];

export function TestView({ users }: { users: any[] }) {
  const [targetUserId, setTargetUserId] = React.useState(users[0]?.id || "");
  const [eventType, setEventType] = React.useState<EventType>("neighbor_topup_received");
  const [dataStr, setDataStr] = React.useState(
    JSON.stringify({ amount: 5000, neighborName: "John Doe", siteName: "Lekki Phase 1" }, null, 2)
  );
  const [sending, setSending] = React.useState(false);
  const [results, setResults] = React.useState<any[] | null>(null);

  const handleTest = async () => {
    try {
      const parsedData = JSON.parse(dataStr);
      setSending(true);
      setResults(null);
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, eventType, data: parsedData }),
      });
      const json = await res.json();
      setSending(false);

      if (res.ok) {
        toast.success("Dispatch complete!");
        setResults(json.results);
      } else {
        toast.error(json.error || "Failed to dispatch");
      }
    } catch (err: any) {
      toast.error("Invalid JSON data");
      setSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="rounded-xl border border-navy-100 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="text-navy-700/60 block mb-1">Target User</span>
            <select
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              className="w-full rounded-lg border border-navy-100 bg-offwhite px-3 py-2"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name || "Unknown"} ({u.role}) - {u.email}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-navy-700/60 block mb-1">Event Type</span>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value as EventType)}
              className="w-full rounded-lg border border-navy-100 bg-offwhite px-3 py-2"
            >
              {EVENTS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-navy-700/60 block mb-1">Mock Data (JSON)</span>
            <textarea
              value={dataStr}
              onChange={(e) => setDataStr(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-navy-100 bg-offwhite px-3 py-2 font-mono text-xs"
            />
          </label>

          <button
            onClick={handleTest}
            disabled={sending}
            className="w-full rounded-lg bg-navy-950 px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {sending ? "Dispatching..." : "Fire Event"}
          </button>
        </div>
      </div>

      {results && (
        <div className="rounded-xl border border-green/20 bg-green/5 p-6 h-fit">
          <h3 className="font-semibold text-green mb-4">Dispatch Results</h3>
          <ul className="space-y-2">
            {results.map((r, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="font-mono text-navy-950">{r.channel}</span>
                <span className={r.success ? "text-green font-bold" : "text-red font-bold"}>
                  {r.success ? "Success" : "Failed"}
                </span>
              </li>
            ))}
            {results.length === 0 && (
              <li className="text-sm text-navy-700/60">No channels targeted. Check user preferences.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
