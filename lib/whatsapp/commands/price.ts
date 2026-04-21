import "server-only";
import type { CommandHandler } from "./types";
import { formatNgn } from "../context";

/**
 * PRICE — current per-kWh price from the active host connection.
 */
export const priceHandler: CommandHandler = async (_supabase, ctx) => {
  if (!ctx.connection) {
    return {
      reply:
        "No active connection. Ask your host to activate your meter and try again.",
    };
  }
  const kobo = Math.round(ctx.connection.current_price_per_kwh * 100);
  const host = ctx.connection.host_name ?? "your host";
  return {
    reply: `Current price from ${host}: ${formatNgn(kobo)}/kWh.`,
  };
};
