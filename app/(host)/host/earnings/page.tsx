"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useWallet } from "@/lib/hooks/host/useWallet";
import { useEarnings } from "@/lib/hooks/host/useEarnings";
import type { Period } from "@/lib/utils/date";
import { useConnections } from "@/lib/hooks/host/useConnections";
import { useTransactions } from "@/lib/hooks/host/useTransactions";
import { useRealtimeWallet } from "@/lib/hooks/host/useRealtimeWallet";
import { EarningsChart } from "@/components/host/EarningsChart";
import { ContributionChart } from "@/components/host/ContributionChart";
import { ActivityFeed } from "@/components/host/ActivityFeed";
import { Button, Skeleton } from "@/components/ui";
import { formatNgn } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

const periods: { label: string; value: Period }[] = [
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
  { label: "Year", value: "year" },
];

export default function EarningsPage() {
  const [period, setPeriod] = useState<Period>("week");
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { data: earnings, isLoading: earningsLoading } = useEarnings(period);
  const { data: connections = [] } = useConnections();
  const { data: transactions = [] } = useTransactions(30);

  useRealtimeWallet();

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest font-mono text-navy-400 mb-1">
            Host Dashboard
          </p>
          <h1 className="text-2xl font-display font-bold text-navy-900">
            Earnings
          </h1>
        </div>
        <Button asChild size="sm">
          <Link href="/host/earnings/withdraw">
            <ArrowUpRight className="h-4 w-4 mr-1.5" />
            Withdraw
          </Link>
        </Button>
      </div>

      {/* Wallet balance */}
      <div className="bg-navy-950 rounded-2xl px-5 py-4 mb-4">
        <p className="text-[10px] text-navy-400 font-mono uppercase tracking-widest mb-1">
          Available Balance
        </p>
        {walletLoading ? (
          <Skeleton className="h-9 w-40 bg-navy-800" />
        ) : (
          <p className="text-3xl font-mono font-bold text-white leading-none">
            {wallet ? formatNgn(wallet.balance) : "₦0.00"}
          </p>
        )}
      </div>

      {/* Period selector */}
      <div className="flex gap-2 mb-5">
        {periods.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={cn(
              "flex-1 py-2 text-sm font-bold font-mono rounded-[10px] transition-colors border",
              period === p.value
                ? "bg-navy-950 text-white border-navy-950"
                : "bg-white text-navy-500 border-navy-100 hover:border-navy-200",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Period total */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white rounded-[12px] border border-navy-100 p-4">
          <p className="text-[10px] text-navy-400 font-mono uppercase tracking-wider mb-1">
            {period === "week"
              ? "This Week"
              : period === "month"
                ? "This Month"
                : "This Year"}
          </p>
          {earningsLoading ? (
            <Skeleton className="h-7 w-24" />
          ) : (
            <p className="text-2xl font-mono font-bold text-navy-900">
              {earnings ? formatNgn(earnings.period, { compact: true }) : "₦0"}
            </p>
          )}
        </div>
        <div className="bg-white rounded-[12px] border border-navy-100 p-4">
          <p className="text-[10px] text-navy-400 font-mono uppercase tracking-wider mb-1">
            Today
          </p>
          {earningsLoading ? (
            <Skeleton className="h-7 w-24" />
          ) : (
            <p className="text-2xl font-mono font-bold text-navy-900">
              {earnings ? formatNgn(earnings.today, { compact: true }) : "₦0"}
            </p>
          )}
        </div>
      </div>

      {/* Line chart */}
      {earnings && (
        <div className="mb-5">
          <h2 className="text-[10px] font-bold uppercase tracking-widest font-mono text-navy-400 mb-2">
            Daily Earnings
          </h2>
          <EarningsChart data={earnings.byDay} />
        </div>
      )}

      {/* Contribution by neighbor */}
      <div className="mb-5">
        <h2 className="text-[10px] font-bold uppercase tracking-widest font-mono text-navy-400 mb-2">
          By Neighbor
        </h2>
        <ContributionChart data={earnings?.byNeighbor ?? []} />
      </div>

      {/* Transaction history */}
      <div>
        <h2 className="text-[10px] font-bold uppercase tracking-widest font-mono text-navy-400 mb-2">
          Transactions
        </h2>
        <ActivityFeed transactions={transactions} connections={connections} />
      </div>
    </div>
  );
}
