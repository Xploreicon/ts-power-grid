/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AdminRole } from "@/lib/auth/admin-guard";

interface DisputeActionsProps {
  disputeId: string;
  role: AdminRole;
  currentStatus: string;
  connectionId?: string;
  hostId?: string;
  neighborId?: string;
  raisedBy?: string;
}

export function DisputeActions({
  disputeId,
  role,
  currentStatus,
  connectionId,
  hostId,
  neighborId,
  raisedBy,
}: DisputeActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [activePanel, setActivePanel] = useState<
    "none" | "resolve" | "reject" | "escalate" | "request_info"
  >("none");

  // Refund form state
  const [refundAmount, setRefundAmount] = useState("");
  const [refundSource, setRefundSource] = useState<"host" | "treasury">("treasury");
  const [resolutionMessage, setResolutionMessage] = useState("");

  // Reject form state
  const [rejectReason, setRejectReason] = useState("");

  // Escalate form state
  const [escalateReason, setEscalateReason] = useState("");

  // Request info state
  const [requestInfoMessage, setRequestInfoMessage] = useState("");

  const patch = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/disputes/${disputeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      toast.error(`Failed: ${txt.slice(0, 100)}`);
      return false;
    }
    toast.success("Dispute updated");
    router.refresh();
    return true;
  };

  const handleResolve = async () => {
    const amountKobo = Math.round(parseFloat(refundAmount || "0") * 100);
    const body: Record<string, unknown> = {
      status: "resolved",
      resolution: resolutionMessage || "Resolved in favor of reporter",
      internal_note: `Resolved with ${amountKobo > 0 ? `refund of ₦${refundAmount} from ${refundSource}` : "no refund"}.`,
    };

    if (amountKobo > 0) {
      // Permission check: admin can only refund up to ₦10,000 (1,000,000 kobo)
      if (role !== "super_admin" && amountKobo > 1_000_000) {
        toast.error("Refunds over ₦10,000 require super_admin. Please escalate.");
        return;
      }
      body.action = "issue_refund";
      body.refund = {
        amountKobo,
        source: refundSource,
        recipientId: raisedBy,
        hostId,
        connectionId,
      };
    }

    await patch(body);
    setActivePanel("none");
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    await patch({
      status: "rejected",
      resolution: rejectReason.trim(),
      internal_note: `Rejected: ${rejectReason.trim()}`,
    });
    setActivePanel("none");
  };

  const handleEscalate = async () => {
    if (!escalateReason.trim()) {
      toast.error("Please provide an escalation reason");
      return;
    }
    await patch({
      status: "escalated",
      internal_note: `Escalated to super_admin: ${escalateReason.trim()}`,
      escalate: true,
    });
    setActivePanel("none");
  };

  const handleRequestInfo = async () => {
    if (!requestInfoMessage.trim()) {
      toast.error("Please provide a message");
      return;
    }
    await patch({
      status: "awaiting_info",
      internal_note: `Requested more info: ${requestInfoMessage.trim()}`,
      request_info_message: requestInfoMessage.trim(),
    });
    setActivePanel("none");
  };

  return (
    <div className="flex flex-col gap-3 min-w-[320px]">
      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => { patch({ assign_to_me: true }); })}
          className="rounded-lg border border-navy-100 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-offwhite disabled:opacity-40"
        >
          Assign to me
        </button>
        {currentStatus === "open" && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(() => { patch({ status: "investigating" }); })
            }
            className="rounded-lg bg-navy-950 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Start Investigation
          </button>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            setActivePanel(activePanel === "resolve" ? "none" : "resolve")
          }
          className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
        >
          ✓ Resolve
        </button>
        <button
          type="button"
          onClick={() =>
            setActivePanel(activePanel === "reject" ? "none" : "reject")
          }
          className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
        >
          ✗ Reject
        </button>
        <button
          type="button"
          onClick={() =>
            setActivePanel(activePanel === "escalate" ? "none" : "escalate")
          }
          className="rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-600"
        >
          ↑ Escalate
        </button>
        <button
          type="button"
          onClick={() =>
            setActivePanel(
              activePanel === "request_info" ? "none" : "request_info",
            )
          }
          className="rounded-lg border border-navy-100 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-offwhite"
        >
          ? Request Info
        </button>
      </div>

      {/* Resolve Panel */}
      {activePanel === "resolve" && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-3">
          <h4 className="font-semibold text-sm text-green-800">
            Resolve in favor of reporter
          </h4>
          <div>
            <label className="block text-xs font-medium text-green-800 mb-1">
              Refund Amount (₦) — leave 0 for no refund
            </label>
            <input
              type="number"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-green-200 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-green-800 mb-1">
              Refund Source
            </label>
            <select
              value={refundSource}
              onChange={(e) =>
                setRefundSource(e.target.value as "host" | "treasury")
              }
              className="w-full rounded-lg border border-green-200 px-3 py-1.5 text-sm"
            >
              <option value="treasury">T&S Treasury</option>
              <option value="host">Host Balance</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-green-800 mb-1">
              Message to reporter
            </label>
            <textarea
              value={resolutionMessage}
              onChange={(e) => setResolutionMessage(e.target.value)}
              placeholder="Your dispute has been resolved..."
              className="w-full rounded-lg border border-green-200 px-3 py-1.5 text-sm resize-none"
              rows={2}
            />
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => { handleResolve(); })}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-40"
          >
            Confirm Resolution
          </button>
        </div>
      )}

      {/* Reject Panel */}
      {activePanel === "reject" && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
          <h4 className="font-semibold text-sm text-red-800">Reject dispute</h4>
          <div>
            <label className="block text-xs font-medium text-red-800 mb-1">
              Reason (required)
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              className="w-full rounded-lg border border-red-200 px-3 py-1.5 text-sm resize-none"
              rows={2}
            />
          </div>
          <button
            type="button"
            disabled={pending || !rejectReason.trim()}
            onClick={() => startTransition(() => { handleReject(); })}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
          >
            Confirm Rejection
          </button>
        </div>
      )}

      {/* Escalate Panel */}
      {activePanel === "escalate" && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 space-y-3">
          <h4 className="font-semibold text-sm text-orange-800">
            Escalate to Super Admin
          </h4>
          <div>
            <label className="block text-xs font-medium text-orange-800 mb-1">
              Reason for escalation
            </label>
            <textarea
              value={escalateReason}
              onChange={(e) => setEscalateReason(e.target.value)}
              placeholder="Why this needs super admin attention..."
              className="w-full rounded-lg border border-orange-200 px-3 py-1.5 text-sm resize-none"
              rows={2}
            />
          </div>
          <button
            type="button"
            disabled={pending || !escalateReason.trim()}
            onClick={() => startTransition(() => { handleEscalate(); })}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-40"
          >
            Confirm Escalation
          </button>
        </div>
      )}

      {/* Request Info Panel */}
      {activePanel === "request_info" && (
        <div className="rounded-lg border border-navy-200 bg-offwhite p-4 space-y-3">
          <h4 className="font-semibold text-sm text-navy-800">
            Request more information
          </h4>
          <div>
            <label className="block text-xs font-medium text-navy-800 mb-1">
              Message to reporter
            </label>
            <textarea
              value={requestInfoMessage}
              onChange={(e) => setRequestInfoMessage(e.target.value)}
              placeholder="What additional information do you need?"
              className="w-full rounded-lg border border-navy-200 px-3 py-1.5 text-sm resize-none"
              rows={2}
            />
          </div>
          <button
            type="button"
            disabled={pending || !requestInfoMessage.trim()}
            onClick={() => startTransition(() => { handleRequestInfo(); })}
            className="rounded-lg bg-navy-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            Send Request
          </button>
        </div>
      )}

      {/* Add note */}
      <div className="flex items-center gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Internal note…"
          className="flex-1 rounded-lg border border-navy-100 bg-white px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          disabled={pending || !note.trim()}
          onClick={() =>
            startTransition(() => {
              patch({ internal_note: note.trim() }).then(() => setNote(""));
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
