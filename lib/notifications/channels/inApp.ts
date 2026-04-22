/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { createAdminClient } from "@/lib/supabase/admin";

export async function sendInApp(
  userId: string,
  eventType: string,
  payload: { title: string; body: string; url?: string },
  data: Record<string, any>
): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    
    // We store URL in the data JSONB so the frontend can redirect if needed
    const finalData = { ...data, _url: payload.url };

    const { error } = await supabase.from("notifications").insert({
      user_id: userId,
      type: eventType,
      title: payload.title,
      body: payload.body,
      data: finalData,
    });

    if (error) {
      console.error("[sendInApp] Supabase error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[sendInApp] Exception:", err);
    return false;
  }
}
