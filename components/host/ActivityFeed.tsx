import { cn } from "@/lib/utils/cn";
import { formatTs } from "@/lib/utils/date";
import { formatTxAmount } from "@/lib/utils/money";
import type { Transaction } from "@/lib/supabase/types";
import type { ConnectionWithNeighbor } from "@/lib/hooks/host/useConnections";

interface ActivityFeedProps {
  transactions: Transaction[];
  connections: ConnectionWithNeighbor[];
}

const typeIcon: Record<string, string> = {
  consumption: "⚡",
  withdrawal: "↑",
  topup: "↓",
  platform_fee: "•",
  installment: "🏠",
  refund: "↩",
};

const typeBg: Record<string, string> = {
  consumption: "bg-green-100 text-green-700",
  withdrawal: "bg-navy-100 text-navy-600",
  topup: "bg-yellow-100 text-yellow-700",
  platform_fee: "bg-navy-50 text-navy-400",
  installment: "bg-blue-50 text-blue-600",
  refund: "bg-amber-50 text-amber-600",
};

export function ActivityFeed({ transactions, connections }: ActivityFeedProps) {
  if (transactions.length === 0) {
    return (
      <div className="bg-white rounded-[12px] border border-navy-100 p-8 text-center">
        <p className="text-navy-400 text-sm">No activity yet.</p>
        <p className="text-navy-300 text-xs mt-1">
          Add a neighbor to start earning.
        </p>
      </div>
    );
  }

  const connMap: Record<string, string> = Object.fromEntries(
    connections.map((c) => [
      c.id,
      c.neighbor.full_name ?? c.neighbor.phone ?? "Neighbor",
    ]),
  );

  const label = (txn: Transaction) => {
    if (txn.type === "consumption" && txn.connection_id) {
      return `Power sold · ${connMap[txn.connection_id] ?? "Neighbor"}`;
    }
    if (txn.type === "withdrawal") return "Withdrawal";
    if (txn.type === "topup") return "Wallet top-up";
    if (txn.type === "platform_fee") return "Platform fee";
    if (txn.type === "installment") return "Installment payment";
    if (txn.type === "refund") return "Refund";
    return txn.type;
  };

  return (
    <div className="space-y-2">
      {transactions.map((txn) => (
        <div
          key={txn.id}
          className="flex items-center gap-3 bg-white rounded-[12px] p-4 border border-navy-100"
        >
          <div
            className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center text-sm flex-shrink-0",
              typeBg[txn.type] ?? "bg-navy-100 text-navy-500",
            )}
          >
            {typeIcon[txn.type] ?? "•"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-navy-900 truncate">
              {label(txn)}
            </p>
            <p className="text-xs text-navy-400 font-mono mt-0.5">
              {formatTs(txn.created_at)}
            </p>
          </div>
          <span
            className={cn(
              "text-sm font-mono font-bold flex-shrink-0",
              txn.amount >= 0 ? "text-green-600" : "text-red-600",
            )}
          >
            {formatTxAmount(txn.amount)}
          </span>
        </div>
      ))}
    </div>
  );
}
