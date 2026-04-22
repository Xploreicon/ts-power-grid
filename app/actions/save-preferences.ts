"use server";

import { createClient } from "@/lib/supabase/server";

export async function savePreferences(preferences: Record<string, boolean>) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ preferences })
    .eq("id", user.id);

  if (error) {
    console.error("[savePreferences] Error:", error);
    return { error: "Failed to save preferences" };
  }

  return { success: true };
}
