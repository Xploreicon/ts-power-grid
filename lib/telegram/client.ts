import "server-only";
import { Telegraf } from "telegraf";

/**
 * Thin wrapper around Telegraf — we use it only for the webhook handler
 * and for outbound `sendMessage` calls. The Bot API itself is fronted
 * by `Telegraf.telegram` which is a typed Bot API client; we don't need
 * scenes, sessions, or middleware.
 *
 * The bot instance is module-level cached so concurrent webhook requests
 * share one HTTPS keep-alive pool. It's lazily constructed because the
 * token isn't available at import time on a Vercel cold start.
 */

export class TelegramConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TelegramConfigError";
  }
}

let _bot: Telegraf | null = null;

export function getBot(): Telegraf {
  if (_bot) return _bot;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new TelegramConfigError("TELEGRAM_BOT_TOKEN is not set");
  }
  _bot = new Telegraf(token);
  return _bot;
}

/**
 * Send plain text to a chat. Splits at 4,096 chars (Bot API limit).
 * Returns the Telegram message_id of the *last* chunk so callers can
 * persist it for status callbacks.
 */
export async function sendMessage(
  chatId: number | string,
  text: string,
): Promise<{ messageId: number }> {
  const bot = getBot();
  // Bot API caps a single message at 4,096 characters. We rarely hit
  // this — usage / history are the only commands that come close —
  // but split defensively rather than letting the API 400.
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 4_000) {
    const cut = remaining.lastIndexOf("\n", 4_000);
    const split = cut > 0 ? cut : 4_000;
    chunks.push(remaining.slice(0, split));
    remaining = remaining.slice(split).trimStart();
  }
  chunks.push(remaining);

  let lastId = 0;
  for (const chunk of chunks) {
    const res = await bot.telegram.sendMessage(chatId, chunk, {
      // `disable_web_page_preview` keeps the Paystack URL preview off the
      // message — the link should be the focus, not a screenshot of the
      // checkout page.
      link_preview_options: { is_disabled: true },
    });
    lastId = res.message_id;
  }
  return { messageId: lastId };
}

/**
 * Send a message with a one-shot reply keyboard that asks for the
 * user's contact (phone). Telegram clients render this as a button
 * the user taps to share their stored phone number with the bot.
 *
 * Used by the `/start` flow to bind chat_id ↔ phone.
 */
export async function sendContactRequest(
  chatId: number | string,
  prompt: string,
): Promise<void> {
  const bot = getBot();
  await bot.telegram.sendMessage(chatId, prompt, {
    reply_markup: {
      keyboard: [
        [
          {
            text: "📱 Share my phone number",
            request_contact: true,
          },
        ],
      ],
      one_time_keyboard: true,
      resize_keyboard: true,
    },
  });
}

/**
 * Set the webhook URL on Telegram's side. We don't call this at runtime
 * — it's invoked once during deployment via a setup script — but it
 * lives here so the implementation is colocated with the rest of the
 * Bot API surface we use.
 */
export async function setWebhook(
  url: string,
  secretToken: string,
): Promise<void> {
  const bot = getBot();
  await bot.telegram.setWebhook(url, {
    secret_token: secretToken,
    allowed_updates: ["message", "callback_query"],
  });
}

/**
 * Constant-time check for the secret_token Telegram sends on every
 * webhook delivery. Header: `X-Telegram-Bot-Api-Secret-Token`.
 */
export function verifyTelegramSecret(
  header: string | null,
  expected: string,
): boolean {
  if (!header || !expected) return false;
  if (header.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < header.length; i++) {
    mismatch |= header.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}
