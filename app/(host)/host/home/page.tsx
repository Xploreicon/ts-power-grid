"use client";

import { useUser } from "@/lib/hooks/useUser";
import { useWallet } from "@/lib/hooks/host/useWallet";
import { useConnections } from "@/lib/hooks/host/useConnections";
import { useTransactions } from "@/lib/hooks/host/useTransactions";
import { useEarnings } from "@/lib/hooks/host/useEarnings";
import { useHostTelemetry } from "@/lib/hooks/host/useHostTelemetry";
import { useRealtimeWallet } from "@/lib/hooks/host/useRealtimeWallet";
import { useRealtimeConnections } from "@/lib/hooks/host/useRealtimeConnections";
import { formatNgn } from "@/lib/utils/money";
import { greet } from "@/lib/utils/date";
import { StatGrid } from "@/components/host/StatGrid";
import { ActivityFeed } from "@/components/host/ActivityFeed";
import { UsageChart } from "@/components/host/UsageChart";
import { QuickActions } from "@/components/host/QuickActions";
import { InstallPrompt } from "@/components/host/InstallPrompt";
import { Badge, Skeleton } from "@/components/ui";

export default function HostHomePage() {
  const profile = useUser();
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { data: connections = [] } = useConnections();
  const { data: transactions = [] } = useTransactions(10);
  const { data: earnings } = useEarnings("week");
  const { data: telemetry } = useHostTelemetry();

  // Wire up realtime subscriptions
  useRealtimeWallet();
  useRealtimeConnections();

  const activeConnections = connections.filter((c) => c.status === "active");
  const firstName = profile?.full_name?.split(" ")[0] ?? "Host";

  return (
    <div className="max-w-2xl mx-auto px-4">
      {/* ── Greeting ── */}
      <div className="pt-6 pb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest font-mono text-navy-400 mb-1">
          {greet()}
        </p>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold text-navy-900">
            {profile ? (
              firstName
            ) : (
              <Skeleton className="h-7 w-28 inline-block" />
            )}
          </h1>
          {activeConnections.length > 0 && (
            <Badge variant="success" dot pulse>
              Grid active
            </Badge>
          )}
        </div>
      </div>

      {/* ── Wallet balance card ── */}
      <div className="mt-3 bg-navy-950 rounded-2xl px-5 py-4">
        <p className="text-[10px] text-navy-400 font-mono uppercase tracking-widest mb-1">
          Wallet Balance
        </p>
        {walletLoading ? (
          <Skeleton className="h-9 w-40 bg-navy-800" />
        ) : (
          <p className="text-3xl font-mono font-bold text-white leading-none">
            {wallet ? formatNgn(wallet.balance) : "₦0.00"}
          </p>
        )}
        <p className="text-navy-500 text-xs mt-2 font-mono">
          Today:{" "}
          <span className="text-yellow-400">
            {earnings ? formatNgn(earnings.today) : "₦0.00"}
          </span>
        </p>
      </div>

      {/* ── Stats grid ── */}
      <StatGrid connections={connections} earnings={earnings} telemetry={telemetry} />

      {/* ── Quick actions ── */}
      <QuickActions />

      {/* ── Weekly earnings chart ── */}
      {earnings && (
        <div className="mt-6">
          <h2 className="text-[10px] font-bold uppercase tracking-widest font-mono text-navy-400 mb-2">
            This Week
          </h2>
          <UsageChart data={earnings.byDay} />
        </div>
      )}

      {/* ── Activity feed ── */}
      <div className="mt-6 pb-6">
        <h2 className="text-[10px] font-bold uppercase tracking-widest font-mono text-navy-400 mb-2">
          Recent Activity
        </h2>
        <ActivityFeed transactions={transactions} connections={connections} />
      </div>

      <InstallPrompt />
    </div>
  );
}
