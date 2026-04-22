/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { notFound } from "next/navigation";
import { format, formatDistanceToNow, differenceInHours } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatNgnKobo } from "@/lib/admin/format";
import { DisputeActions } from "./dispute-actions";
import type { DisputeContext } from "@/lib/admin/dispute-context";

export const dynamic = "force-dynamic";

function getSlaStatus(createdAt: string): {
  label: string;
  color: string;
  hoursElapsed: number;
} {
  const hours = differenceInHours(new Date(), new Date(createdAt));
  if (hours < 1) return { label: "On-time", color: "text-green-600 bg-green-50", hoursElapsed: hours };
  if (hours < 24) return { label: "Warning", color: "text-yellow-600 bg-yellow-50", hoursElapsed: hours };
  return { label: "SLA Breached", color: "text-red-600 bg-red-50", hoursElapsed: hours };
}

export default async function DisputeDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireAdmin();
  const supabase = createAdminClient();

  const { data: dispute } = await supabase
    .from("disputes")
    .select(
      `id, category, status, description, resolution, created_at, resolved_at,
       assigned_to, raised_by, connection_id, context, source, photos,
       refund_amount_kobo, refund_source, escalated_to, escalated_at,
       sla_acknowledged_at,
       profiles:raised_by(full_name, phone, role)`,
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!dispute) notFound();

  const connectionId = dispute.connection_id as string | null;
  const raisedBy = dispute.raised_by as string | null;
  const ctx = (dispute.context as DisputeContext) ?? null;

  // Fetch notes
  const { data: notes } = await supabase
    .from("dispute_notes")
    .select("id, body, created_at, profiles:author_id(full_name)")
    .eq("dispute_id", params.id)
    .order("created_at", { ascending: true });

  // Related disputes on same connection
  const { data: relatedDisputes } = connectionId
    ? await supabase
        .from("disputes")
        .select("id, category, status, created_at")
        .eq("connection_id", connectionId)
        .neq("id", params.id)
        .order("created_at", { ascending: false })
        .limit(5)
    : { data: [] };

  // Connection info for refund form
  let hostId: string | null = null;
  let neighborId: string | null = null;
  if (connectionId) {
    const { data: conn } = await supabase
      .from("connections")
      .select("host_id, neighbor_id")
      .eq("id", connectionId)
      .maybeSingle();
    hostId = conn?.host_id ?? null;
    neighborId = conn?.neighbor_id ?? null;
  }

  const profile = dispute.profiles as unknown as
    | { full_name: string | null; phone: string | null; role: string | null }
    | null;

  const status = dispute.status as string;
  const sla = getSlaStatus(dispute.created_at as string);
  const isClosed = status === "resolved" || status === "rejected";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-navy-100 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-navy-700/60">
              <span>Case #{(dispute.id as string).slice(0, 8).toUpperCase()}</span>
              <span>·</span>
              <span>{(dispute.category as string).replace(/_/g, " ")}</span>
              <span>·</span>
              <span className="capitalize">{dispute.source as string}</span>
            </div>
            <h1 className="mt-1 font-display text-2xl font-semibold">
              {profile?.full_name ?? "Unknown user"}
            </h1>
            <p className="font-mono text-sm text-navy-700/70">
              {profile?.phone ?? ""}{" "}
              <span className="capitalize text-navy-400">({profile?.role ?? ""})</span>
            </p>
            <div className="mt-2 flex items-center gap-2">
              <StatusBadge status={status} />
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${sla.color}`}>
                {sla.label} ({sla.hoursElapsed}h)
              </span>
              <span className="text-xs text-navy-700/60">
                Raised{" "}
                {format(new Date(dispute.created_at as string), "d MMM yyyy HH:mm")}
                {" "}({formatDistanceToNow(new Date(dispute.created_at as string))} ago)
              </span>
            </div>
            {dispute.resolved_at && (
              <p className="mt-1 text-xs text-navy-400">
                Resolved {format(new Date(dispute.resolved_at as string), "d MMM yyyy HH:mm")}
              </p>
            )}
          </div>
          {!isClosed && (
            <DisputeActions
              disputeId={dispute.id as string}
              role={session.role}
              currentStatus={status}
              connectionId={connectionId ?? undefined}
              hostId={hostId ?? undefined}
              neighborId={neighborId ?? undefined}
              raisedBy={raisedBy ?? undefined}
            />
          )}
        </div>
        <div className="mt-4 rounded-lg bg-offwhite p-3 text-sm text-navy-950 whitespace-pre-wrap">
          {(dispute.description as string) ?? "(no description)"}
        </div>
        {/* Refund badge */}
        {dispute.refund_amount_kobo && Number(dispute.refund_amount_kobo) > 0 && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-green-50 px-3 py-1.5 text-sm font-semibold text-green-700">
            ✅ Refund {formatNgnKobo(Number(dispute.refund_amount_kobo))} from{" "}
            {(dispute.refund_source as string) ?? "unknown"}
          </div>
        )}
      </div>

      {/* Context Snapshot */}
      {ctx && ctx.connection && (
        <div className="rounded-2xl border border-navy-100 bg-white p-5">
          <h2 className="font-display text-lg font-semibold mb-4">Context Snapshot</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="rounded-lg bg-offwhite p-3">
              <p className="text-xs uppercase tracking-widest text-navy-700/60 mb-1">Connection</p>
              <p className="font-semibold">{ctx.connection.status}</p>
              <p className="font-mono text-xs text-navy-400">
                ₦{ctx.connection.currentPricePerKwh}/kWh
              </p>
            </div>
            <div className="rounded-lg bg-offwhite p-3">
              <p className="text-xs uppercase tracking-widest text-navy-700/60 mb-1">Wallet Balance</p>
              <p className="font-semibold font-mono">
                {ctx.walletBalance !== null ? formatNgnKobo(ctx.walletBalance) : "N/A"}
              </p>
            </div>
            <div className="rounded-lg bg-offwhite p-3">
              <p className="text-xs uppercase tracking-widest text-navy-700/60 mb-1">Gateway</p>
              <p className="font-semibold">{ctx.gateway?.status ?? "Unknown"}</p>
              {ctx.gateway?.lastSeenAt && (
                <p className="text-xs text-navy-400">
                  Last seen {formatDistanceToNow(new Date(ctx.gateway.lastSeenAt))} ago
                </p>
              )}
            </div>
          </div>

          {/* Recent transactions from snapshot */}
          {ctx.recentTransactions.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-navy-700/60 mb-2">
                Transactions (last 24h at time of dispute)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-navy-100 text-xs uppercase text-navy-700/60">
                      <th className="py-2 pr-3">Time</th>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3">Amount</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ctx.recentTransactions.map((t) => (
                      <tr key={t.id} className="border-t border-navy-100">
                        <td className="py-1.5 font-mono text-xs">
                          {format(new Date(t.createdAt), "d MMM HH:mm")}
                        </td>
                        <td className="capitalize">{t.type.replace(/_/g, " ")}</td>
                        <td className="font-mono">{formatNgnKobo(t.amount)}</td>
                        <td><StatusBadge status={t.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Meter readings */}
          {ctx.recentReadings.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-navy-700/60 mb-2">
                Meter Readings (last 24h)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-navy-100 text-xs uppercase text-navy-700/60">
                      <th className="py-2 pr-3">Time</th>
                      <th className="py-2">Cumulative kWh</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ctx.recentReadings.map((r, i) => (
                      <tr key={i} className="border-t border-navy-100">
                        <td className="py-1.5 font-mono text-xs">
                          {format(new Date(r.recordedAt), "d MMM HH:mm")}
                        </td>
                        <td className="font-mono">{r.cumulativeKwh.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Prior disputes count */}
          {ctx.priorDisputes > 0 && (
            <p className="mt-3 text-xs text-yellow-600 font-semibold">
              ⚠️ {ctx.priorDisputes} prior dispute(s) on this connection
            </p>
          )}
        </div>
      )}

      {/* Related Disputes */}
      {(relatedDisputes ?? []).length > 0 && (
        <div className="rounded-2xl border border-navy-100 bg-white p-5">
          <h2 className="font-display text-lg font-semibold mb-3">Related Disputes</h2>
          <div className="space-y-2">
            {(relatedDisputes ?? []).map((d: any) => (
              <a
                key={d.id}
                href={`/admin/disputes/${d.id}`}
                className="flex items-center justify-between rounded-lg border border-navy-100 p-3 hover:bg-offwhite transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-navy-400">
                    #{d.id.slice(0, 8).toUpperCase()}
                  </span>
                  <span className="capitalize text-sm">
                    {d.category.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={d.status} />
                  <span className="text-xs text-navy-400">
                    {format(new Date(d.created_at), "d MMM yyyy")}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Investigation Notes */}
      <div className="rounded-2xl border border-navy-100 bg-white p-5">
        <h2 className="font-display text-lg font-semibold mb-3">Investigation Notes</h2>
        {(notes ?? []).length === 0 ? (
          <p className="text-sm text-navy-700/60">No notes yet.</p>
        ) : (
          <div className="space-y-3">
            {(notes ?? []).map((n: any) => (
              <div key={n.id} className="rounded-lg bg-offwhite p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-semibold text-navy-700">
                    {(n.profiles as any)?.full_name ?? "Admin"}
                  </span>
                  <span className="text-xs text-navy-400">
                    {format(new Date(n.created_at), "d MMM HH:mm")}
                  </span>
                </div>
                <p className="mt-1 text-sm text-navy-950 whitespace-pre-wrap">{n.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
