import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deliverTelegramMessage } from "./delivery";
import { resolveChatForUser } from "./binding";
import {
  formatNgn,
  formatKwh,
  type NotificationPrefs,
} from "@/lib/whatsapp/context";

/**
 * Proactive (platform-initiated) Telegram messages.
 *
 * Mirrors `lib/whatsapp/proactive.ts` so the channel switcher in
 * `lib/messaging/index.ts` can swap one for the other without callers
 * noticing. Function signatures are identical; only the wire format
 * differs.
 *
 * Each function:
 *   1. Loads phone + notification_prefs + the (possibly-null) chat_id.
 *   2. Respects the `whatsapp_opt_in` flag — yes, the column is named
 *      for the legacy channel, but it gates conversational messaging
 *      regardless of provider. Splitting it would force every host to
 *      re-confirm preferences on migration.
 *   3. Hands off to `deliverTelegramMessage`, which falls back to SMS
 *      when the user hasn't bound their chat yet.
 *
 * Welcome messages compose the bot's URL into the SMS fallback so a
 * brand-new neighbor — who has never opened Telegram — can still reach
 * the bot. The URL is read from `TELEGRAM_BOT_USERNAME`.
 */

type Recipient = {
  userId: string;
  phone: string;
  chatId: number | null;
  prefs: NotificationPrefs;
};

async function loadRecipient(
  supabase: SupabaseClient,
  userId: string,
): Promise<Recipient | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id, phone, telegram_chat_id, notification_prefs")
    .eq("id", userId)
    .maybeSingle();
  if (!data || !data.phone) return null;
  const rawChat = (data as { telegram_chat_id?: unknown }).telegram_chat_id;
  return {
    userId: data.id as string,
    phone: data.phone as string,
    chatId: typeof rawChat === "number" ? rawChat : null,
    prefs: (data.notification_prefs as NotificationPrefs | null) ?? {},
  };
}

function optedIn(prefs: NotificationPrefs): boolean {
  return prefs.whatsapp_opt_in !== false;
}

function botUrl(): string | null {
  const username = process.env.TELEGRAM_BOT_USERNAME;
  return username ? `https://t.me/${username}` : null;
}

/**
 * Welcome message on first successful connection. Drives binding —
 * if the user hasn't started the bot yet, the SMS fallback carries
 * the bot's URL so they can.
 */
export async function sendWelcomeMessage(
  supabase: SupabaseClient,
  userId: string,
  opts: { hostName: string; pricePerKwh: number },
): Promise<void> {
  const r = await loadRecipient(supabase, userId);
  if (!r || !optedIn(r.prefs)) return;

  const url = botUrl();
  const lines = [
    `Welcome to T&S Power Grid! 🔆`,
    ``,
    `You're now connected to ${opts.hostName}'s solar grid at ₦${opts.pricePerKwh}/kWh — about 40% less than NEPA.`,
    ``,
    `Manage your account on Telegram:`,
    `• /bal — check balance + today's usage`,
    `• /top 500 — top up ₦500`,
    `• /usage — last 7 days`,
    `• /help — all commands`,
  ];
  if (r.chatId === null && url) {
    lines.push(``, `Open ${url} and tap Start to verify your account.`);
  } else {
    lines.push(``, `Top up anytime to keep your power on.`);
  }

  await deliverTelegramMessage(supabase, {
    userId: r.userId,
    chatId: r.chatId,
    phone: r.phone,
    body: lines.join("\n"),
  });

  await supabase
    .from("profiles")
    .update({
      notification_prefs: {
        ...r.prefs,
        welcomed_at: new Date().toISOString(),
      },
    })
    .eq("id", r.userId);
}

/**
 * Low balance warning — fired by the billing engine when the wallet
 * drops below the threshold. Caller throttles to once per day.
 */
export async function sendLowBalanceWarning(
  supabase: SupabaseClient,
  userId: string,
  opts: { balanceKobo: number; estimatedHoursLeft?: number },
): Promise<void> {
  const r = await loadRecipient(supabase, userId);
  if (!r || !optedIn(r.prefs)) return;

  const lines = [
    `⚠️ Low balance warning`,
    ``,
    `Your wallet is ${formatNgn(opts.balanceKobo)}.`,
  ];
  if (opts.estimatedHoursLeft !== undefined) {
    lines.push(
      `At current usage, you have about ${opts.estimatedHoursLeft.toFixed(1)} hours left.`,
    );
  }
  lines.push(``, `Top up now to avoid disconnection: send /top 500`);

  await deliverTelegramMessage(supabase, {
    userId: r.userId,
    chatId: r.chatId,
    phone: r.phone,
    body: lines.join("\n"),
  });
}

/**
 * Meter cut due to zero balance.
 */
export async function sendDisconnectNotification(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const r = await loadRecipient(supabase, userId);
  if (!r || !optedIn(r.prefs)) return;

  const body = [
    `🔌 Power disconnected`,
    ``,
    `Your wallet balance has reached ₦0 and your meter is now off.`,
    ``,
    `Send /top 500 (or any amount) to top up and reconnect automatically.`,
  ].join("\n");

  await deliverTelegramMessage(supabase, {
    userId: r.userId,
    chatId: r.chatId,
    phone: r.phone,
    body,
  });
}

/**
 * Meter reconnected after a successful top-up.
 */
export async function sendReconnectConfirmation(
  supabase: SupabaseClient,
  userId: string,
  opts: { newBalanceKobo: number },
): Promise<void> {
  const r = await loadRecipient(supabase, userId);
  if (!r || !optedIn(r.prefs)) return;

  const body = [
    `✅ Power restored`,
    ``,
    `Thanks for topping up. Your new balance is ${formatNgn(opts.newBalanceKobo)} and your meter is back on.`,
  ].join("\n");

  await deliverTelegramMessage(supabase, {
    userId: r.userId,
    chatId: r.chatId,
    phone: r.phone,
    body,
  });
}

/**
 * Daily summary at 8pm (Africa/Lagos). Opt-in via
 * notification_prefs.daily_summary_opt_in === true.
 */
export async function sendDailySummary(
  supabase: SupabaseClient,
  userId: string,
  data: {
    kwhToday: number;
    spentKoboToday: number;
    balanceKobo: number;
  },
): Promise<void> {
  const r = await loadRecipient(supabase, userId);
  if (!r || !optedIn(r.prefs)) return;
  if (r.prefs.daily_summary_opt_in !== true) return;

  const body = [
    `📊 Today's power summary`,
    ``,
    `Used: ${formatKwh(data.kwhToday)}`,
    `Spent: ${formatNgn(data.spentKoboToday)}`,
    `Balance: ${formatNgn(data.balanceKobo)}`,
    ``,
    `Send /usage for the 7-day breakdown.`,
  ].join("\n");

  await deliverTelegramMessage(supabase, {
    userId: r.userId,
    chatId: r.chatId,
    phone: r.phone,
    body,
  });
}

// Re-export for convenience — callers can `import { resolveChatForUser }`
// from this module rather than reaching into `binding.ts`.
export { resolveChatForUser };
