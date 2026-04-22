import { notFound } from "next/navigation";
import { format } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatNgnKobo } from "@/lib/admin/format";
import { DisputeActions } from "./dispute-actions";

export const dynamic = "force-dynamic";

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
      "id, category, status, description, resolution, created_at, resolved_at, assigned_to, raised_by, connection_id, profiles:raised_by(full_name, phone)",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!dispute) notFound();

  const connectionId = dispute.connection_id as string | null;
  const raisedBy = dispute.raised_by as string | null;

  const [recentTx, meterAudit, wallet] = await Promise.all([
    raisedBy
      ? supabase
          .from("transactions")
          .select("id, type, amount, status, created_at, reference, wallet_id")
          .in(
            "wallet_id",
            (
              await supabase.from("wallets").select("id").eq("user_id", raisedBy)
            ).data?.map((w) => w.id) ?? [],
          )
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
    connectionId
      ? supabase
          .from("billing_audit")
          .select("id, event_type, details, created_at")
          .eq("connection_id", connectionId)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
    raisedBy
      ? supabase.from("wallets").select("balance").eq("user_id", raisedBy).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const profile = (dispute.profiles as unknown) as
    | { full_name: string | null; phone: string | null }
    | null;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-navy-100 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-navy-700/60">
              Dispute · {(dispute.category as string) ?? "other"}
            </div>
            <h1 className="mt-1 font-display text-2xl font-semibold">
              {profile?.full_name ?? "Unknown user"}
            </h1>
            <p className="font-mono text-sm text-navy-700/70">
              {profile?.phone ?? ""}
            </p>
            <div className="mt-2">
              <StatusBadge status={dispute.status as string} />
              <span className="ml-2 text-xs text-navy-700/60">
                Raised{" "}
                {format(new Date(dispute.created_at as string), "d MMM yyyy HH:mm")}
              </span>
            </div>
          </div>
          <DisputeActions
            disputeId={dispute.id as string}
            role={session.role}
            currentStatus={(dispute.status as string) ?? "open"}
          />
        </div>
        <div className="mt-4 rounded-lg bg-offwhite p-3 text-sm text-navy-950 whitespace-pre-wrap">
          {(dispute.description as string) ?? "(no description)"}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-navy-100 bg-white p-5">
          <h2 className="font-display text-lg font-semibold">Wallet</h2>
          <p className="mt-2 font-mono text-2xl font-semibold">
            {formatNgnKobo(Number((wallet.data as { balance?: number } | null)?.balance ?? 0))}
          </p>
          <h3 className="mt-4 text-xs font-bold uppercase tracking-widest text-navy-700/60">
            Last 10 transactions
          </h3>
          <table className="mt-2 w-full text-left text-sm">
            <tbody>
              {(recentTx.data ?? []).map((t) => {
                const tt = t as {
                  id: string;
                  type: string;
                  amount: number;
                  status: string;
                  created_at: string;
                };
                return (
                  <tr key={tt.id} className="border-t border-navy-100">
                    <td className="py-1.5 font-mono text-xs">
                      {format(new Date(tt.created_at), "d MMM HH:mm")}
                    </td>
                    <td className="capitalize">{tt.type.replace(/_/g, " ")}</td>
                    <td className="font-mono">
                      {formatNgnKobo(Number(tt.amount))}
                    </td>
                    <td>
                      <StatusBadge status={tt.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl border border-navy-100 bg-white p-5">
          <h2 className="font-display text-lg font-semibold">Connection audit</h2>
          {((meterAudit.data ?? []) as { id: string }[]).length === 0 ? (
            <p className="mt-2 text-sm text-navy-700/60">
              No audit events recorded for this connection.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {(meterAudit.data ?? []).map((a) => {
                const aa = a as {
                  id: string;
                  event_type: string;
                  created_at: string;
                };
                return (
                  <li
                    key={aa.id}
                    className="flex items-baseline gap-2 border-t border-navy-100 pt-1.5"
                  >
                    <span className="font-mono text-xs text-navy-700/60">
                      {format(new Date(aa.created_at), "d MMM HH:mm")}
                    </span>
                    <span className="font-medium">
                      {aa.event_type.replace(/_/g, " ")}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
