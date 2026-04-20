"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/useUser";
import type { Site } from "@/lib/supabase/types";

export function useSite() {
  const profile = useUser();
  const userId = profile?.id;

  return useQuery<Site | null>({
    queryKey: ["site", userId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("sites")
        .select("*")
        .eq("host_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as Site | null;
    },
    enabled: !!userId,
  });
}
