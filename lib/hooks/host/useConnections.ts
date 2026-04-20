"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/useUser";
import type { Connection, Profile, Meter } from "@/lib/supabase/types";

export type ConnectionWithNeighbor = Omit<Connection, "neighbor_id" | "meter_id"> & {
  neighbor_id: string;
  meter_id: string;
  neighbor: Pick<Profile, "id" | "full_name" | "phone">;
  meter: Pick<Meter, "id" | "serial_number" | "status" | "last_reading_kwh">;
};

export function useConnections(statusFilter?: Connection["status"]) {
  const profile = useUser();
  const userId = profile?.id;

  return useQuery<ConnectionWithNeighbor[]>({
    queryKey: ["connections", userId, statusFilter],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from("connections")
        .select(`
          *,
          neighbor:profiles!connections_neighbor_id_fkey(id, full_name, phone),
          meter:meters!connections_meter_id_fkey(id, serial_number, status, last_reading_kwh)
        `)
        .eq("host_id", userId!)
        .order("created_at", { ascending: false });

      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as ConnectionWithNeighbor[];
    },
    enabled: !!userId,
  });
}

export function useConnection(connectionId: string | undefined) {
  const profile = useUser();
  const userId = profile?.id;

  return useQuery<ConnectionWithNeighbor | null>({
    queryKey: ["connection", connectionId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("connections")
        .select(`
          *,
          neighbor:profiles!connections_neighbor_id_fkey(id, full_name, phone),
          meter:meters!connections_meter_id_fkey(id, serial_number, status, last_reading_kwh)
        `)
        .eq("id", connectionId!)
        .eq("host_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ConnectionWithNeighbor | null;
    },
    enabled: !!connectionId && !!userId,
  });
}
