import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendMessage } from "./client";
import { sendSms, TermiiError } from "@/lib/termii/client";

/**
 * Send a Telegram message; on failure (or when the recipient hasn't
 * bound their chat yet), fall back to SMS via Termii. Logs the outcome
 * to `whatsapp_messages` — yes, the table is named for the WhatsApp
 * era, but it's our generic outbound-message ledger and reusing it
 * keeps cross-channel reporting sane. The `provider` column tells
 * downstream queries which channel was actually used.
 *
 * Use this for proactive (platform-initiated) messages. Inbound
 * webhook replies use `client.sendMessage` directly because they're
 * always inside an active chat — no fallback needed.
 */
export async function deliverTelegramMessage(
  supabase: SupabaseClient,
  opts: {
    userId?: string | null;
    chatId: number | null;
    phone: string; // E.164 — needed for SMS fallback even if chatId is set
    body: string;
  },
): Promise<{ channel: "telegram" | "sms" | "none"; messageId?: string }> {
  const { userId, chatId, phone, body } = opts;

  let tgMessageId: string | undefined;
  let status: "sent" | "failed" | "fell_back_to_sms" = "sent";
  let error: string | undefined;
  let channel: "telegram" | "sms" | "none" = "telegram";

  if (chatId !== null) {
    try {
      const res = await sendMessage(chatId, body);
      tgMessageId = String(res.messageId);
    } catch (err) {
      error = (
        err instanceof Error ? err.message : "Telegram send failed"
      ).slice(0, 500);
      // Fall through to SMS.
      const smsResult = await trySms(phone, body);
      if (smsResult.ok) {
        channel = "sms";
        status = "fell_back_to_sms";
        error = `Telegram: ${error} → fell back to SMS`;
      } else {
        channel = "none";
        status = "failed";
        error = `${error}; SMS: ${smsResult.error}`.slice(0, 500);
      }
    }
  } else {
    // No bound chat — go straight to SMS so the user still gets the
    // message. The first SMS we send to a new neighbor typically
    // includes the bot's URL (composed by the proactive sender).
    const smsResult = await trySms(phone, body);
    if (smsResult.ok) {
      channel = "sms";
      status = "fell_back_to_sms";
      error = "Telegram: chat not bound → SMS";
    } else {
      channel = "none";
      status = "failed";
      error = `Telegram: chat not bound; SMS: ${smsResult.error}`.slice(0, 500);
    }
  }

  await supabase.from("whatsapp_messages").insert({
    direction: "outbound",
    user_id: userId ?? null,
    phone,
    wa_message_id: tgMessageId ?? null,
    body,
    status,
    error: error ?? null,
    provider: channel === "sms" ? "termii_sms" : "telegram_bot",
  });

  return { channel, messageId: tgMessageId };
}

async function trySms(
  phone: string,
  body: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await sendSms({ to: phone, sms: body });
    return { ok: true };
  } catch (smsErr) {
    const msg =
      smsErr instanceof TermiiError
        ? smsErr.message
        : smsErr instanceof Error
          ? smsErr.message
          : "Termii failed";
    return { ok: false, error: msg };
  }
}
