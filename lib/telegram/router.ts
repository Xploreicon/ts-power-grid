import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadContext } from "@/lib/whatsapp/context";
import { balHandler } from "@/lib/whatsapp/commands/bal";
import { topHandler } from "@/lib/whatsapp/commands/top";
import { usageHandler } from "@/lib/whatsapp/commands/usage";
import { priceHandler } from "@/lib/whatsapp/commands/price";
import { helpHandler } from "@/lib/whatsapp/commands/help";
import { reportHandler } from "@/lib/whatsapp/commands/report";
import type {
  CommandHandler,
  CommandResult,
} from "@/lib/whatsapp/commands/types";
import { rateLimit } from "@/lib/paystack/rate-limit";

/**
 * Telegram command router.
 *
 * Re-uses the existing WhatsApp command handlers — they take
 * `(supabase, NeighborContext, input)` and return a string reply, so
 * the channel they're running under is irrelevant to them. Only the
 * subset the user explicitly asked for is wired here: BAL, TOP, USAGE,
 * PRICE, HELP, REPORT. STOP/START/HISTORY remain WhatsApp-only.
 *
 * Telegram messages arrive in two forms:
 *   1. Slash commands — `/bal`, `/top 500`, … We strip the slash and
 *      treat the rest as a WhatsApp-style message.
 *   2. Plain text — handled the same way for forgiveness ("BAL" or
 *      "balance" both work).
 *
 * Rate-limit keys are namespaced `tg:<phone>` so a single user
 * messaging on both WhatsApp and Telegram doesn't share a bucket and
 * accidentally throttle one channel.
 */

const COMMANDS: Record<string, { handler: CommandHandler; name: string }> = {
  BAL: { handler: balHandler, name: "bal" },
  BALANCE: { handler: balHandler, name: "bal" },
  TOP: { handler: topHandler, name: "top" },
  TOPUP: { handler: topHandler, name: "top" },
  USAGE: { handler: usageHandler, name: "usage" },
  PRICE: { handler: priceHandler, name: "price" },
  RATE: { handler: priceHandler, name: "price" },
  HELP: { handler: helpHandler, name: "help" },
  MENU: { handler: helpHandler, name: "help" },
  REPORT: { handler: reportHandler, name: "report" },
  ISSUE: { handler: reportHandler, name: "report" },
};

export interface TelegramRouteInput {
  phone: string; // E.164, resolved from chat_id ↔ phone binding
  body: string; // raw message text, slash already stripped
  chatId: number;
}

export interface TelegramRouteResult extends CommandResult {
  command: string;
  rateLimited?: boolean;
}

export async function routeTelegramMessage(
  supabase: SupabaseClient,
  input: TelegramRouteInput,
): Promise<TelegramRouteResult> {
  const rl = rateLimit(`tg:${input.phone}`, 20, 60_000);
  if (!rl.allowed) {
    return {
      reply:
        "You're sending messages too fast. Please wait a minute and try again.",
      command: "rate_limited",
      rateLimited: true,
    };
  }

  const { keyword, args } = parseTelegramMessage(input.body);
  if (!keyword) {
    return {
      reply: `I didn't understand that. Send /help to see commands.`,
      command: "unknown",
    };
  }

  const entry = COMMANDS[keyword];
  if (!entry) {
    return {
      reply: `"${keyword.toLowerCase()}" isn't a command I know.\n\n${HELP_TEXT_TG}`,
      command: "unknown",
    };
  }

  try {
    const ctx = await loadContext(supabase, input.phone);
    const result = await entry.handler(supabase, ctx, {
      raw: input.body,
      args,
    });
    return {
      reply: result.reply,
      command: result.commandName ?? entry.name,
    };
  } catch (err) {
    console.error("[telegram] command failed:", err);
    return {
      reply:
        "Sorry, something went wrong. Please try again, or send /help for other options.",
      command: entry.name,
    };
  }
}

/**
 * Strip a leading slash + bot mention (Telegram appends `@BotName` in
 * group chats) and then parse the same way the WhatsApp router does:
 * the first alphabetic run is the keyword, everything after it is
 * `args`.
 */
export function parseTelegramMessage(body: string): {
  keyword: string | null;
  args: string;
} {
  let trimmed = body.trim();
  if (!trimmed) return { keyword: null, args: "" };

  // `/bal`, `/top@MyBot 500`, `bal`, `BAL`. Drop the slash + @mention
  // before running the same regex the WhatsApp side uses.
  if (trimmed.startsWith("/")) {
    trimmed = trimmed.slice(1);
    const at = trimmed.indexOf("@");
    const space = trimmed.indexOf(" ");
    if (at > 0 && (space === -1 || at < space)) {
      const end = space > 0 ? space : trimmed.length;
      trimmed = trimmed.slice(0, at) + trimmed.slice(end);
    }
  }

  const match = /^([a-zA-Z]+)\b\s*([\s\S]*)$/.exec(trimmed);
  if (!match) return { keyword: null, args: "" };
  return {
    keyword: match[1].toUpperCase(),
    args: (match[2] ?? "").trim(),
  };
}

// Telegram-flavoured help text — same content, slash prefixes match
// the conversation style users expect on this channel.
export const HELP_TEXT_TG = [
  "T&S Power commands:",
  "",
  "• /bal — balance + today's usage",
  "• /top 500 — top up ₦500 (Paystack link)",
  "• /usage — today + last 7 days",
  "• /price — current rate per kWh",
  "• /report <issue> — raise a ticket",
  "• /help — this message",
].join("\n");
