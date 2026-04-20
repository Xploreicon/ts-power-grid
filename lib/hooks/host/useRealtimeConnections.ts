"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/useUser";

/** Subscribes to connection row changes and invalidates the cached connections list. */
export function useRealtimeConnections() {
  const profile = useUser();
  const userId = profile?.id;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`connections:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "connections",
          filter: `host_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["connections", userId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
