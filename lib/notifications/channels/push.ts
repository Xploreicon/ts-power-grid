/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

// VAPID keys should be generated once (e.g. `npx web-push generate-vapid-keys`)
// and stored in environment variables.
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const privateKey = process.env.VAPID_PRIVATE_KEY || "";
const subject = process.env.VAPID_SUBJECT || "mailto:admin@tspowergrid.com";

if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export async function sendPush(
  userId: string,
  eventType: string,
  payload: { title: string; body: string; url?: string }
): Promise<boolean> {
  if (!publicKey || !privateKey) {
    console.warn("[sendPush] VAPID keys not configured, skipping push.");
    return false;
  }

  try {
    const supabase = createAdminClient();
    
    // Fetch all push subscriptions for this user
    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId);

    if (error || !subs || subs.length === 0) {
      return false; // No subscriptions
    }

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url,
      tag: eventType, // use eventType as collapse_key so multiple topups collapse
    });

    let successCount = 0;

    // Send to all active endpoints
    await Promise.all(
      subs.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            auth: sub.auth,
            p256dh: sub.p256dh,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, notificationPayload);
          successCount++;
        } catch (err: any) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            // Subscription expired or unsubscribed, clean it up
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          } else {
            console.error(`[sendPush] Failed to send to endpoint ${sub.endpoint}:`, err);
          }
        }
      })
    );

    return successCount > 0;
  } catch (err) {
    console.error("[sendPush] Exception:", err);
    return false;
  }
}
