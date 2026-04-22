"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AdminRole } from "@/lib/auth/admin-guard";

/**
 * Admin action cluster for a single dispute. Super-admin-only actions
 * (refund, wallet adjustment) are hidden for plain admins — belt-and-braces:
 * the server route re-checks the role before executing.
 */
export function DisputeActions({
  disputeId,
  role,
  currentStatus,
}: {
  disputeId: string;
  role: AdminRole;
  currentStatus: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");

  const patch = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/disputes/${disputeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      toast.error(`Failed: ${txt.slice(0, 100)}`);
      return;
    }
    toast.success("Dispute updated");
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => patch({ assign_to_me: true }))}
          className="rounded-lg border border-navy-100 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-offwhite disabled:opacity-40"
        >
          Assign to me
        </button>
        <select
          defaultValue={currentStatus}
          onChange={(e) =>
            startTransition(() => patch({ status: e.target.value }))
          }
          disabled={pending}
          className="rounded-lg border border-navy-100 bg-white px-2 py-1.5 text-sm"
        >
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="resolved">Resolved</option>
          <option value="rejected">Rejected</option>
        </select>
        {role === "super_admin" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(() => patch({ action: "issue_refund" }))
            }
            className="rounded-lg border border-yellow-500 bg-yellow-500/10 px-3 py-1.5 text-sm font-semibold text-navy-950 hover:bg-yellow-500/20 disabled:opacity-40"
          >
            Issue refund
          </button>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Internal note…"
          className="w-64 rounded-lg border border-navy-100 bg-white px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          disabled={pending || !note.trim()}
          onClick={() =>
            startTransition(async () => {
              await patch({ internal_note: note.trim() });
              setNote("");
            })
          }
          className="rounded-lg bg-navy-950 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          Add note
        </button>
      </div>
    </div>
  );
}
