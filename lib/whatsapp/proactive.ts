import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deliverMessage } from "./delivery";
import { formatNgn, formatKwh, type NotificationPrefs } from "./context";

/**
 * Proactive (platform-initiated) WhatsApp messages.
 *
 * Every function here:
 *   1. Loads the recipient's phone + notification_prefs.
 *   2. Respects opt-in flags (default opt-in unless explicitly false).
 *   3. Delegates to deliverMessage() which handles SMS fallback + logging.
 *
 * Messages outside the WhatsApp 24h customer-care window require an
 * approved template; we pass `template` where applicable. See
 * docs/whatsapp-templates.md for the template copy we submit to Meta.
 */

type Recipient = {
  userId: string;
  phone: string;
  prefs: NotificationPrefs;
};

async function loadRecipient(
  supabase: SupabaseClient,
  userId: string,
): Promise<Recipient | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id, phone, notification_prefs")
    .eq("id", userId)
    .maybeSingle();
  if (!data || !data.phone) return null;
  return {
    userId: data.id as string,
    phone: data.phone as string,
    prefs: (data.notification_prefs as NotificationPrefs | null) ?? {},
  };
}

function optedIn(prefs: NotificationPrefs): boolean {
  // Default ON. Only skip when explicitly opted out.
  return prefs.whatsapp_opt_in !== false;
}

/**
 * Welcome message on first successful connection. Uses template
 * `welcome_connection` because this is typically the first message we
 * ever send the user (no open session window).
 */
export async function sendWelcomeMessage(
  supabase: SupabaseClient,
  userId: string,
  opts: { hostName: string; pricePerKwh: number },
): Promise<void> {
  const r = await loadRecipient(supabase, userId);
  if (!r || !optedIn(r.prefs)) return;

  const body = [
    `Welcome to T&S Power Grid! 🔆`,
    ``,
    `You're now connected to ${opts.hostName}'s solar grid at ₦${opts.pricePerKwh}/kWh — about 40% less than NEPA.`,
    ``,
    `Here's how to use WhatsApp with us:`,
    `• BAL — check balance + today's usage`,
    `• TOP 500 — top up ₦500`,
    `• USAGE — last 7 days`,
    `• HELP — all commands`,
    ``,
    `Top up anytime to keep your power on. Reply HELP if you get stuck.`,
  ].join("\n");

  await deliverMessage(supabase, {
    userId: r.userId,
    phone: r.phone,
    body,
    template: {
      name: "welcome_connection",
      variables: [opts.hostName, String(opts.pricePerKwh)],
    },
  });

  // Mark so we don't send twice.
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
 * Low balance warning — fired by billing engine when wallet drops
 * below ₦200 (20,000 kobo). Caller should throttle (once per day).
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
  lines.push(``, `Top up now to avoid disconnection: reply TOP 500`);

  await deliverMessage(supabase, {
    userId: r.userId,
    phone: r.phone,
    body: lines.join("\n"),
    template: {
      name: "low_balance_warning",
      variables: [formatNgn(opts.balanceKobo)],
    },
  });
}

/**
 * Meter has been cut due to zero balance. Includes direct top-up prompt.
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
    `Reply TOP 500 (or any amount) to top up and reconnect automatically.`,
  ].join("\n");

  await deliverMessage(supabase, {
    userId: r.userId,
    phone: r.phone,
    body,
    template: {
      name: "meter_disconnected",
      variables: [],
    },
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

  await deliverMessage(supabase, {
    userId: r.userId,
    phone: r.phone,
    body,
    template: {
      name: "meter_reconnected",
      variables: [formatNgn(opts.newBalanceKobo)],
    },
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
    `Reply USAGE for the 7-day breakdown, or STOP to pause these summaries.`,
  ].join("\n");

  await deliverMessage(supabase, {
    userId: r.userId,
    phone: r.phone,
    body,
    template: {
      name: "daily_summary",
      variables: [
        formatKwh(data.kwhToday),
        formatNgn(data.spentKoboToday),
        formatNgn(data.balanceKobo),
      ],
    },
  });
}
