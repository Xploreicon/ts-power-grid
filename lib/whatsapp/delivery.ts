import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendMessage, sendTemplate, WhatsAppError } from "./client";
import { sendSms, TermiiError } from "@/lib/termii/client";

/**
 * Send a WhatsApp message; on failure, fall back to SMS via Termii.
 * Logs the outcome to `whatsapp_messages` regardless.
 *
 * Use this for all outbound user-facing messages.
 */
export async function deliverMessage(
  supabase: SupabaseClient,
  opts: {
    userId?: string | null;
    phone: string;
    body: string;
    /** If set, try template first (for outside-24h-window messages). */
    template?: { name: string; variables: string[]; languageCode?: string };
  },
): Promise<{ channel: "whatsapp" | "sms" | "none"; messageId?: string }> {
  const { userId, phone, body, template } = opts;
  let waMessageId: string | undefined;
  let status:
    | "sent"
    | "failed"
    | "fell_back_to_sms" = "sent";
  let error: string | undefined;
  let channel: "whatsapp" | "sms" | "none" = "whatsapp";

  try {
    if (template) {
      const res = await sendTemplate(
        phone,
        template.name,
        template.variables,
        template.languageCode,
      );
      waMessageId = res.messageId;
    } else {
      const res = await sendMessage(phone, body);
      waMessageId = res.messageId;
    }
  } catch (err) {
    const whatsappError = err instanceof WhatsAppError ? err : null;
    error = (err instanceof Error ? err.message : "WhatsApp send failed").slice(
      0,
      500,
    );

    // Fall back to SMS. If Termii also fails, record failure and bail.
    try {
      await sendSms({ to: phone, sms: body });
      channel = "sms";
      status = "fell_back_to_sms";
      error = `WhatsApp: ${error} → fell back to SMS`;
    } catch (smsErr) {
      channel = "none";
      status = "failed";
      const smsMsg =
        smsErr instanceof TermiiError
          ? smsErr.message
          : smsErr instanceof Error
            ? smsErr.message
            : "Termii failed";
      error = `${error}; SMS: ${smsMsg}`.slice(0, 500);
    }

    // Tag error so retries can differentiate.
    void whatsappError;
  }

  await supabase.from("whatsapp_messages").insert({
    direction: "outbound",
    user_id: userId ?? null,
    phone,
    wa_message_id: waMessageId ?? null,
    body,
    status,
    error: error ?? null,
    provider: channel === "sms" ? "termii_sms" : "whatsapp_cloud",
  });

  return { channel, messageId: waMessageId };
}
