import "server-only";

/**
 * Conversational messaging channel switcher.
 *
 * The platform speaks to neighbors over either WhatsApp or Telegram.
 * Both implementations live behind matching function signatures:
 *
 *   sendWelcomeMessage(supabase, userId, { hostName, pricePerKwh })
 *   sendLowBalanceWarning(supabase, userId, { balanceKobo, ... })
 *   sendDisconnectNotification(supabase, userId)
 *   sendReconnectConfirmation(supabase, userId, { newBalanceKobo })
 *   sendDailySummary(supabase, userId, { kwhToday, ... })
 *
 * The active channel is selected by `MESSAGING_CHANNEL` (`whatsapp` or
 * `telegram`); default is `whatsapp` so existing deployments don't
 * change behaviour on this commit.
 *
 * Why this lives here and not as a runtime registry: the channel never
 * changes per-message. A static module-load decision keeps the call
 * sites zero-overhead and avoids leaking channel-specific options
 * (template IDs, chat_ids) into the engine.
 */

import * as wa from "@/lib/whatsapp/proactive";
import * as tg from "@/lib/telegram/proactive";

export type MessagingChannel = "whatsapp" | "telegram";

export function activeChannel(): MessagingChannel {
  const raw = (process.env.MESSAGING_CHANNEL ?? "whatsapp")
    .trim()
    .toLowerCase();
  return raw === "telegram" ? "telegram" : "whatsapp";
}

const useTelegram = activeChannel() === "telegram";

export const sendWelcomeMessage = useTelegram
  ? tg.sendWelcomeMessage
  : wa.sendWelcomeMessage;

export const sendLowBalanceWarning = useTelegram
  ? tg.sendLowBalanceWarning
  : wa.sendLowBalanceWarning;

export const sendDisconnectNotification = useTelegram
  ? tg.sendDisconnectNotification
  : wa.sendDisconnectNotification;

export const sendReconnectConfirmation = useTelegram
  ? tg.sendReconnectConfirmation
  : wa.sendReconnectConfirmation;

export const sendDailySummary = useTelegram
  ? tg.sendDailySummary
  : wa.sendDailySummary;
