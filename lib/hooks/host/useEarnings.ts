"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/useUser";
import {
  getPeriodBuckets,
  getTodayStart,
  type Period,
} from "@/lib/utils/date";

export interface EarningsDay {
  day: string;   // bucket label e.g. "Mon" / "12" / "Apr"
  date: string;  // bucket key e.g. "2026-04-19" / "2026-04"
  total: number; // kobo
}

export interface EarningsSummary {
  today: number;          // kobo
  period: number;         // kobo
  byDay: EarningsDay[];
  byNeighbor: { name: string; total: number }[];
}

export function useEarnings(period: Period = "week") {
  const profile = useUser();
  const userId = profile?.id;

  return useQuery<EarningsSummary>({
    queryKey: ["earnings", userId, period],
    queryFn: async () => {
      const supabase = createClient();

      const { data: wallet } = await supabase
        .from("wallets")
        .select("id")
        .eq("user_id", userId!)
        .maybeSingle();
      if (!wallet) return { today: 0, period: 0, byDay: [], byNeighbor: [] };

      const { start, buckets, granularity } = getPeriodBuckets(period);
      const todayStart = getTodayStart();

      const { data: txns } = await supabase
        .from("transactions")
        .select("amount, created_at, connection_id")
        .eq("wallet_id", wallet.id)
        .eq("type", "consumption")
        .eq("status", "success")
        .gte("created_at", start);

      const rows = (txns ?? []) as {
        amount: number;
        created_at: string;
        connection_id: string | null;
      }[];

      const today = rows
        .filter((r) => r.created_at >= todayStart)
        .reduce((s, r) => s + r.amount, 0);

      const periodTotal = rows.reduce((s, r) => s + r.amount, 0);

      // Bucket totals
      const bucketMap: Record<string, number> = {};
      rows.forEach((r) => {
        const key =
          granularity === "day"
            ? r.created_at.slice(0, 10)
            : r.created_at.slice(0, 7);
        bucketMap[key] = (bucketMap[key] ?? 0) + r.amount;
      });
      const byDay: EarningsDay[] = buckets.map((b) => ({
        date: b.key,
        day: b.label,
        total: bucketMap[b.key] ?? 0,
      }));

      // Group by connection → neighbor name
      const connTotals: Record<string, number> = {};
      rows.forEach((r) => {
        if (!r.connection_id) return;
        connTotals[r.connection_id] =
          (connTotals[r.connection_id] ?? 0) + r.amount;
      });
      const connIds = Object.keys(connTotals);
      let byNeighbor: { name: string; total: number }[] = [];
      if (connIds.length) {
        const { data: conns } = await supabase
          .from("connections")
          .select(
            "id, neighbor:profiles!connections_neighbor_id_fkey(full_name, phone)",
          )
          .in("id", connIds);
        const connList = (conns ?? []) as unknown as {
          id: string;
          neighbor: { full_name: string | null; phone: string | null } | null;
        }[];
        byNeighbor = connList
          .map((c) => ({
            name: c.neighbor?.full_name ?? c.neighbor?.phone ?? "Unknown",
            total: connTotals[c.id] ?? 0,
          }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 6);
      }

      return { today, period: periodTotal, byDay, byNeighbor };
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}
