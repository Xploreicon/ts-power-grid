"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/useUser";
import type { Wallet } from "@/lib/supabase/types";

export function useWallet() {
  const profile = useUser();
  const userId = profile?.id;

  return useQuery<Wallet | null>({
    queryKey: ["wallet", userId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as Wallet | null;
    },
    enabled: !!userId,
    staleTime: 10_000,
  });
}
