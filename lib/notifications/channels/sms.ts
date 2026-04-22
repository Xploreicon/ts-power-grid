import { createAdminClient } from "@/lib/supabase/admin";
import { sendSms } from "@/lib/termii/client";

export async function sendTermiiSms(
  userId: string,
  eventType: string,
  payload: { body: string }
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
      console.warn(`[sendTermiiSms] User ${userId} has no phone number, skipping SMS.`);
      return false;
    }

    await sendSms({
      to: profile.phone,
      sms: payload.body,
    });

    return true;
  } catch (err) {
    console.error("[sendTermiiSms] Exception:", err);
    return false;
  }
}
