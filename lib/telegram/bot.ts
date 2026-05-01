import "server-only";
import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBot, sendContactRequest } from "./client";
import {
  bindChatToPhone,
  resolvePhoneForChat,
} from "./binding";
import { routeTelegramMessage } from "./router";

/**
 * Stateless Telegraf bot.
 *
 * Wired idempotently — the webhook route imports `handleUpdate` and
 * passes Telegram's update payload straight in. We don't run a long-
 * lived bot process; serverless cold starts re-register the listeners
 * on first invocation.
 *
 * Inbound flow:
 *   1. /start → ask for contact (binding prompt). If already bound,
 *      reply with the help text.
 *   2. contact share → bind chat_id ↔ phone, confirm.
 *   3. /bal /top /usage /price /help /report — resolve chat_id to
 *      phone (rejecting unbound senders) and delegate to the shared
 *      router.
 */

let _registered = false;

function registerHandlers(bot: Telegraf, supabase: SupabaseClient): void {
  if (_registered) return;
  _registered = true;

  bot.start(async (ctx) => {
    const chatId = ctx.chat.id;
    const existing = await resolvePhoneForChat(supabase, chatId);
    if (existing) {
      await ctx.reply(
        [
          `You're already verified. Welcome back! 🔆`,
          ``,
          `• /bal — balance + today's usage`,
          `• /top 500 — top up ₦500`,
          `• /usage — last 7 days`,
          `• /help — all commands`,
        ].join("\n"),
      );
      return;
    }
    await sendContactRequest(
      chatId,
      [
        `Hi! I'm the T&S Power Grid bot.`,
        ``,
        `Tap the button below to share your phone number — we'll match it to your account so you can check your balance and top up here.`,
      ].join("\n"),
    );
  });

  bot.on(message("contact"), async (ctx) => {
    const contact = ctx.message.contact;
    // Only trust the contact when it belongs to the sender — Telegram
    // lets users share *anyone's* contact card otherwise, which would
    // let a stranger bind themselves to a target user's profile.
    if (contact.user_id !== ctx.from.id) {
      await ctx.reply(
        "Please share your *own* contact, not someone else's. Tap the button again.",
        { parse_mode: "Markdown" },
      );
      return;
    }
    const result = await bindChatToPhone(
      supabase,
      contact.phone_number,
      ctx.chat.id,
    );

    if (result.status === "bound") {
      await ctx.reply(
        [
          `✅ Verified.`,
          ``,
          `You're connected as ${result.phone}. Send /help to see what I can do.`,
        ].join("\n"),
        { reply_markup: { remove_keyboard: true } },
      );
      return;
    }
    if (result.status === "phone_not_found") {
      await ctx.reply(
        [
          `I couldn't find a T&S account for ${result.phone}.`,
          ``,
          `Ask your host to add this number, then send /start again.`,
        ].join("\n"),
        { reply_markup: { remove_keyboard: true } },
      );
      return;
    }
    await ctx.reply(
      "Something went wrong on our side. Please try again in a minute.",
      { reply_markup: { remove_keyboard: true } },
    );
  });

  // Catch-all for text — both slash commands and plain messages route
  // through `routeTelegramMessage`, which strips the slash and dispatches
  // to the shared command handlers.
  bot.on(message("text"), async (ctx) => {
    const chatId = ctx.chat.id;
    const phone = await resolvePhoneForChat(supabase, chatId);
    if (!phone) {
      await sendContactRequest(
        chatId,
        "I don't have your phone on file yet. Tap below to share it and I'll set you up.",
      );
      return;
    }

    const result = await routeTelegramMessage(supabase, {
      phone,
      body: ctx.message.text,
      chatId,
    });
    if (result.rateLimited) return;
    await ctx.reply(result.reply, {
      link_preview_options: { is_disabled: true },
    });
  });

  // Don't let a thrown handler take the whole webhook down — log it
  // and reply with a generic apology.
  bot.catch((err, ctx) => {
    console.error("[telegram] bot handler crashed:", err);
    if ("reply" in ctx && typeof ctx.reply === "function") {
      void ctx.reply(
        "Sorry, something went wrong. Please try again, or send /help.",
      );
    }
  });
}

/**
 * Hand a parsed Telegram update to the bot. Called by the webhook
 * route after signature verification + JSON parsing.
 *
 * Accepts an optional `supabase` for tests; production passes a
 * fresh service-role client per request.
 */
export async function handleUpdate(
  update: unknown,
  supabase: SupabaseClient = createAdminClient(),
): Promise<void> {
  const bot = getBot();
  registerHandlers(bot, supabase);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await bot.handleUpdate(update as any);
}
