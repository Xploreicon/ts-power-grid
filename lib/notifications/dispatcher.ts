/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { createAdminClient } from "@/lib/supabase/admin";
import { type EventType, type NotificationChannel } from "./types";
import { TEMPLATES } from "./templates";

// Default enabled channels for each event type if preferences don't override
const DEFAULTS: Record<EventType, NotificationChannel[]> = {
  neighbor_topup_received: ["push", "in_app"],
  neighbor_disconnected: ["push", "in_app"],
  daily_earnings_summary: ["push", "in_app"],
  system_health_alert: ["push", "sms", "in_app"], // sms is for critical
  installment_due_reminder: ["sms", "email"],
  withdrawal_confirmation: ["push", "sms", "email"],
  dispute_raised_against: ["push", "email"],
  dispute_resolution: ["push", "email"],
  welcome_connection: ["whatsapp"],
  topup_confirmation: ["whatsapp"],
  low_balance_warning: ["whatsapp", "sms"],
  disconnect_notification: ["whatsapp", "sms"],
  reconnect_confirmation: ["whatsapp"],
  daily_usage_summary: ["whatsapp"],
  price_change_by_host: ["whatsapp"],
  new_lead_submitted: ["in_app"],
  high_priority_dispute: ["in_app", "email"],
  gateway_offline_prolonged: ["in_app", "email"],
  installment_overdue: ["in_app"],
  system_fault_reported: ["in_app", "email", "sms"],
  large_withdrawal_request: ["in_app", "email"],
  kyc_submission_pending: ["in_app"],
};

// Events that users CANNOT opt-out of for crucial channels
const CRITICAL_OVERRIDES: Partial<Record<EventType, NotificationChannel[]>> = {
  system_health_alert: ["sms", "push"],
  disconnect_notification: ["sms"],
  system_fault_reported: ["sms", "email"],
};

export async function dispatchNotification(
  userId: string,
  eventType: EventType,
  data: Record<string, any>
): Promise<{ channel: NotificationChannel; success: boolean }[]> {
  const supabase = createAdminClient();

  // 1. Load preferences
  const { data: profile } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", userId)
    .single();

  const prefs = (profile?.preferences as Record<string, any>) || {};

  // 2. Determine target channels
  const defaults = DEFAULTS[eventType] || [];
  const overrides = CRITICAL_OVERRIDES[eventType] || [];

  const targetChannels = new Set<NotificationChannel>();
  for (const ch of defaults) {
    const prefKey = `${eventType}_${ch}`;
    // If preference is explicitly false, and it's not a critical override, skip it
    if (prefs[prefKey] === false && !overrides.includes(ch)) {
      continue;
    }
    targetChannels.add(ch);
  }

  // Add any critical overrides that weren't in defaults (just in case)
  for (const ch of overrides) {
    targetChannels.add(ch);
  }

  // 3. Render templates
  const renderer = TEMPLATES[eventType];
  if (!renderer) {
    console.error(`[dispatchNotification] Unknown event type: ${eventType}`);
    return [];
  }
  const rendered = renderer(data);

  // 4. Dispatch to each channel
  const results: { channel: NotificationChannel; success: boolean }[] = [];

  for (const channel of Array.from(targetChannels)) {
    let success = false;
    let errorMessage = "";

    try {
      if (channel === "in_app" && rendered.in_app) {
        const { sendInApp } = await import("./channels/inApp");
        success = await sendInApp(userId, eventType, rendered.in_app, data);
      } else if (channel === "push" && rendered.push) {
        const { sendPush } = await import("./channels/push");
        success = await sendPush(userId, eventType, rendered.push);
      } else if (channel === "sms" && rendered.sms) {
        const { sendTermiiSms } = await import("./channels/sms");
        success = await sendTermiiSms(userId, eventType, rendered.sms);
      } else if (channel === "whatsapp" && rendered.whatsapp) {
        const { sendWhatsApp } = await import("./channels/whatsapp");
        success = await sendWhatsApp(userId, eventType, rendered.whatsapp);
      } else if (channel === "email" && rendered.email) {
        const { sendEmail } = await import("./channels/email");
        success = await sendEmail(userId, eventType, rendered.email);
      } else {
        // We wanted to send, but template wasn't provided for this channel
        continue; 
      }
    } catch (err: any) {
      errorMessage = err.message || String(err);
      success = false;
    }

    results.push({ channel, success });

    // 5. Log delivery
    await supabase.from("notification_deliveries").insert({
      user_id: userId,
      event_type: eventType,
      channel: channel,
      status: success ? "delivered" : "failed",
      error_message: success ? null : errorMessage,
      metadata: data,
    });
  }

  return results;
}
