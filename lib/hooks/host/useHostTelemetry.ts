"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/useUser";
import { getTodayStart } from "@/lib/utils/date";

export interface HostTelemetryStats {
  kwhToday: number;
  currentPowerKw: number;
}

export function useHostTelemetry() {
  const profile = useUser();
  const userId = profile?.id;

  return useQuery<HostTelemetryStats | null>({
    queryKey: ["host-telemetry", userId],
    queryFn: async () => {
      const supabase = createClient();

      // Get the host's solar meter
      const { data: meter } = await supabase
        .from("meters")
        .select("id")
        .eq("user_id", userId!)
        .eq("meter_type", "solar")
        .maybeSingle();

      if (!meter) return { kwhToday: 0, currentPowerKw: 0 };

      const todayStart = getTodayStart();

      const [latestRes, firstRes] = await Promise.all([
        supabase
          .from("telemetry")
          .select("kwh_cumulative, voltage, current")
          .eq("meter_id", meter.id)
          .order("timestamp", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("telemetry")
          .select("kwh_cumulative")
          .eq("meter_id", meter.id)
          .gte("timestamp", todayStart)
          .order("timestamp", { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);

      const latest = latestRes.data;
      const first = firstRes.data;

      if (!latest) return { kwhToday: 0, currentPowerKw: 0 };

      const firstKwh = first ? Number(first.kwh_cumulative) : Number(latest.kwh_cumulative);
      const latestKwh = Number(latest.kwh_cumulative);
      const kwhToday = Math.max(0, latestKwh - firstKwh);

      const volts = Number(latest.voltage || 0);
      const amps = Number(latest.current || 0);
      const currentPowerKw = (volts * amps) / 1000;

      return { kwhToday, currentPowerKw };
    },
    enabled: !!userId,
    // Refetch often since it's telemetry
    refetchInterval: 30_000,
  });
}
