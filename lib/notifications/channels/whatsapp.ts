import { createAdminClient } from "@/lib/supabase/admin";
import { sendTemplate } from "@/lib/whatsapp/client";

export async function sendWhatsApp(
  userId: string,
  eventType: string,
  payload: { templateName: string; parameters: string[] }
): Promise<boolean> {
  try {
    const supabase = createAdminClient();

    // Need phone number from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("phone")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.phone) {
      console.warn(`[sendWhatsApp] User ${userId} has no phone number, skipping WhatsApp.`);
      return false;
    }

    await sendTemplate(profile.phone, payload.templateName, payload.parameters);

    return true;
  } catch (err) {
    console.error("[sendWhatsApp] Exception:", err);
    return false;
  }
}
