/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
"use client";

import * as React from "react";
import { format } from "date-fns";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function DeliveryView({ deliveries }: { deliveries: any[] }) {
  return (
    <div className="rounded-xl border border-navy-100 bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-navy-100 bg-offwhite text-navy-700">
              <th className="px-4 py-3 font-semibold">Time</th>
              <th className="px-4 py-3 font-semibold">Event</th>
              <th className="px-4 py-3 font-semibold">Channel</th>
              <th className="px-4 py-3 font-semibold">Recipient</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-100">
            {deliveries.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-navy-700/50">
                  No deliveries recorded yet.
                </td>
              </tr>
            ) : null}
            {deliveries.map((d) => (
              <tr key={d.id} className="hover:bg-offwhite/50">
                <td className="px-4 py-3 font-mono text-xs text-navy-700/70">
                  {format(new Date(d.created_at), "MMM d, HH:mm")}
                </td>
                <td className="px-4 py-3 text-navy-950 font-medium">
                  {d.event_type}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-navy-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-navy-700">
                    {d.channel}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-navy-700">
                  {d.profiles?.email || d.profiles?.phone || d.user_id.substring(0, 8)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {d.status === "delivered" ? (
                      <CheckCircle2 className="h-4 w-4 text-green" />
                    ) : d.status === "failed" ? (
                      <XCircle className="h-4 w-4 text-red" />
                    ) : (
                      <Clock className="h-4 w-4 text-amber" />
                    )}
                    <span
                      className={cn(
                        "text-xs font-semibold capitalize",
                        d.status === "delivered" && "text-green",
                        d.status === "failed" && "text-red",
                        d.status === "pending" && "text-amber"
                      )}
                    >
                      {d.status}
                    </span>
                    {d.error_message ? (
                      <span className="text-[10px] text-red/70 max-w-[150px] truncate" title={d.error_message}>
                        ({d.error_message})
                      </span>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
