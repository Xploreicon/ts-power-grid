"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/useUser";

/** Subscribes to wallet row changes and invalidates the cached wallet + earnings. */
export function useRealtimeWallet() {
  const profile = useUser();
  const userId = profile?.id;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`wallet:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wallets",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["wallet", userId] });
          queryClient.invalidateQueries({ queryKey: ["transactions", userId] });
          queryClient.invalidateQueries({ queryKey: ["earnings", userId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
