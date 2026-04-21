import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadContext } from "./context";
import { balHandler } from "./commands/bal";
import { topHandler } from "./commands/top";
import { usageHandler } from "./commands/usage";
import { priceHandler } from "./commands/price";
import { helpHandler, HELP_TEXT } from "./commands/help";
import { historyHandler } from "./commands/history";
import { reportHandler } from "./commands/report";
import { startHandler, stopHandler } from "./commands/stop-start";
import type { CommandHandler, CommandResult } from "./commands/types";
import { rateLimit } from "@/lib/paystack/rate-limit";

/**
 * Map of first-word keyword → handler. Keywords are matched
 * case-insensitively; the rest of the message is passed as `args`.
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
  HISTORY: { handler: historyHandler, name: "history" },
  HIST: { handler: historyHandler, name: "history" },
  REPORT: { handler: reportHandler, name: "report" },
  ISSUE: { handler: reportHandler, name: "report" },
  STOP: { handler: stopHandler, name: "stop" },
  START: { handler: startHandler, name: "start" },
};

export interface RouteInput {
  phone: string; // E.164
  body: string;
  waMessageId?: string;
}

export interface RouteResult extends CommandResult {
  command: string;
  rateLimited?: boolean;
}

/**
 * Parse and dispatch an inbound message. Never throws — returns a friendly
 * fallback on any error so the caller can always reply.
 *
 * Rate-limit: 20 messages per minute per sender phone. Exceeding senders
 * get one "slow down" reply, then the router returns rateLimited=true with
 * no reply (caller should skip sending).
 */
export async function routeMessage(
  supabase: SupabaseClient,
  input: RouteInput,
): Promise<RouteResult> {
  const key = `wa:${input.phone}`;
  const rl = rateLimit(key, 20, 60_000);
  if (!rl.allowed) {
    return {
      reply:
        "You're sending messages too fast. Please wait a minute and try again.",
      command: "rate_limited",
      rateLimited: true,
    };
  }

  const { keyword, args, raw } = parseMessage(input.body);
  if (!keyword) {
    return {
      reply: `I didn't understand that. Reply HELP to see commands.`,
      command: "unknown",
    };
  }

  const entry = COMMANDS[keyword];
  if (!entry) {
    return {
      reply: `"${keyword}" isn't a command I know.\n\n${HELP_TEXT}`,
      command: "unknown",
    };
  }

  try {
    const ctx = await loadContext(supabase, input.phone);
    const result = await entry.handler(supabase, ctx, { raw, args });
    return {
      reply: result.reply,
      command: result.commandName ?? entry.name,
    };
  } catch (err) {
    console.error("[whatsapp] command failed:", err);
    return {
      reply:
        "Sorry, something went wrong. Please try again, or reply HELP for other options.",
      command: entry.name,
    };
  }
}

export function parseMessage(body: string): {
  keyword: string | null;
  args: string;
  raw: string;
} {
  const trimmed = body.trim();
  if (!trimmed) return { keyword: null, args: "", raw: body };
  // Equivalent to /^([a-zA-Z]+)\b\s*(.*)$/s — the `s` flag needs ES2018,
  // so we inline `[\s\S]*` to match any char including newlines.
  const match = /^([a-zA-Z]+)\b\s*([\s\S]*)$/.exec(trimmed);
  if (!match) return { keyword: null, args: "", raw: body };
  return {
    keyword: match[1].toUpperCase(),
    args: match[2] ?? "",
    raw: trimmed,
  };
}
