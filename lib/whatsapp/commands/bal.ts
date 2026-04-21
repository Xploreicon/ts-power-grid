import "server-only";
import { startOfDay } from "date-fns";
import type { CommandHandler } from "./types";
import { formatKwh, formatNgn } from "../context";

/**
 * BAL — balance + today's consumption.
 *
 * Sums absolute value of today's `consumption`-type transactions on the
 * neighbor's wallet; emits kwh_consumed total where present.
 */
export const balHandler: CommandHandler = async (supabase, ctx) => {
  if (!ctx.profile || !ctx.wallet) {
    return {
      reply:
        "We couldn't find your account. Please ask your host to add your phone number.",
    };
  }

  const start = startOfDay(new Date()).toISOString();
  const { data: rows } = await supabase
    .from("transactions")
    .select("amount, kwh_consumed, type, created_at")
    .eq("wallet_id", ctx.wallet.id)
    .eq("type", "consumption")
    .gte("created_at", start);

  let spentKobo = 0;
  let kwh = 0;
  for (const r of rows ?? []) {
    spentKobo += Math.abs(Number(r.amount ?? 0));
    kwh += Number(r.kwh_consumed ?? 0);
  }

  const lines = [
    `Balance: ${formatNgn(ctx.wallet.balance_kobo)}`,
    `Today: ${formatKwh(kwh)} · ${formatNgn(spentKobo)}`,
  ];
  if (ctx.connection) {
    lines.push(`Price: ${formatNgn(Math.round(ctx.connection.current_price_per_kwh * 100))}/kWh`);
  }
  lines.push("");
  lines.push("Reply HELP for all commands.");
  return { reply: lines.join("\n") };
};
