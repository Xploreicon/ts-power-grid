"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type AlertSeverity = "info" | "warning" | "critical";
export type AlertKind =
  | "dispute_opened"
  | "gateway_offline"
  | "installment_overdue"
  | "meter_fault";

export interface AdminAlert {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  body: string;
  createdAt: string;
  href?: string;
}

/**
 * Collects admin-facing alerts from a few polling sources + a Supabase
 * Realtime subscription on `disputes`. The polling loops run every 30s;
 * realtime delivers new-dispute toasts instantly.
 *
 * In v1 we do the aggregation client-side to keep the API surface small.
 * When this gets hot we'll move to a DB view or a materialised alerts table.
 */
export function useAdminAlerts() {
  const supabase = createClient();
  const [realtimeCount, setRealtimeCount] = useState(0);

  // Open disputes (urgent).
  const disputes = useQuery({
    queryKey: ["admin", "alerts", "disputes"],
    queryFn: async (): Promise<AdminAlert[]> => {
      if (!supabase) return [];
      const { data } = await supabase
        .from("disputes")
        .select("id, category, description, created_at, status")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(25);
      return (data ?? []).map((d) => ({
        id: `dispute:${d.id}`,
        kind: "dispute_opened",
        severity: "warning",
        title: `New ${String(d.category).replace("_", " ")} dispute`,
        body: String(d.description ?? "").slice(0, 120),
        createdAt: d.created_at as string,
        href: `/admin/disputes/${d.id}`,
      }));
    },
    refetchInterval: 30_000,
    enabled: !!supabase,
  });

  // Offline gateways (haven't reported in >10 min).
  const gateways = useQuery({
    queryKey: ["admin", "alerts", "gateways"],
    queryFn: async (): Promise<AdminAlert[]> => {
      if (!supabase) return [];
      const tenMinAgo = new Date(Date.now() - 10 * 60_000).toISOString();
      const { data } = await supabase
        .from("gateways")
        .select("id, serial_number, site_id, last_seen_at, status")
        .or(`last_seen_at.lt.${tenMinAgo},status.eq.offline`)
        .limit(25);
      return (data ?? []).map((g) => ({
        id: `gateway:${g.id}`,
        kind: "gateway_offline",
        severity: "critical",
        title: `Gateway ${g.serial_number} offline`,
        body: `Last seen ${g.last_seen_at ?? "never"}`,
        createdAt: (g.last_seen_at as string) ?? new Date().toISOString(),
        href: `/admin/sites/${g.site_id}`,
      }));
    },
    refetchInterval: 30_000,
    enabled: !!supabase,
  });

  // Overdue installments.
  const installments = useQuery({
    queryKey: ["admin", "alerts", "installments"],
    queryFn: async (): Promise<AdminAlert[]> => {
      if (!supabase) return [];
      const { data } = await supabase
        .from("installments")
        .select("id, site_id, amount, due_date, status")
        .eq("status", "overdue")
        .order("due_date", { ascending: true })
        .limit(25);
      return (data ?? []).map((i) => ({
        id: `installment:${i.id}`,
        kind: "installment_overdue",
        severity: "warning",
        title: `Installment overdue`,
        body: `Due ${i.due_date}`,
        createdAt: i.due_date as string,
        href: `/admin/sites/${i.site_id}`,
      }));
    },
    refetchInterval: 5 * 60_000,
    enabled: !!supabase,
  });

  // Realtime: pulse counter when a new dispute lands so the badge updates
  // without waiting for the 30s poll.
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("admin-disputes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "disputes" },
        () => {
          setRealtimeCount((n) => n + 1);
          disputes.refetch();
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification("T&S Admin — new dispute raised");
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, disputes]);

  useEffect(() => {
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      void Notification.requestPermission();
    }
  }, []);

  const all: AdminAlert[] = [
    ...(disputes.data ?? []),
    ...(gateways.data ?? []),
    ...(installments.data ?? []),
  ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return {
    alerts: all,
    unread: all.length,
    realtimeCount,
    isLoading:
      disputes.isLoading || gateways.isLoading || installments.isLoading,
  };
}
