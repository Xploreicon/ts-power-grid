"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/types";

async function fetchProfile(userId: string): Promise<Profile | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return data as Profile | null;
}

/**
 * Returns the current user's profile (or null while loading / unauthenticated).
 * SWR caches the profile for 30 s and revalidates on window focus.
 */
export function useUser(): Profile | null {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    // Initial load
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
    });
    // Keep in sync with auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_, session) => setUserId(session?.user?.id ?? null),
    );
    return () => subscription.unsubscribe();
  }, []);

  const { data } = useSWR(
    userId ? ["profile", userId] : null,
    ([, id]) => fetchProfile(id),
    { dedupingInterval: 30_000 },
  );

  if (userId === undefined) return null; // Still loading session
  return data ?? null;
}
