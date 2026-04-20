"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/useUser";
import type { Transaction } from "@/lib/supabase/types";

export function useTransactions(limit = 20) {
  const profile = useUser();
  const userId = profile?.id;

  return useQuery<Transaction[]>({
    queryKey: ["transactions", userId, limit],
    queryFn: async () => {
      const supabase = createClient();

      const { data: wallet, error: walletErr } = await supabase
        .from("wallets")
        .select("id")
        .eq("user_id", userId!)
        .maybeSingle();
      if (walletErr) throw walletErr;
      if (!wallet) return [];

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("wallet_id", wallet.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as Transaction[];
    },
    enabled: !!userId,
  });
}
