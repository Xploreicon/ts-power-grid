import "server-only";
import { startOfDay, subDays } from "date-fns";
import type { CommandHandler } from "./types";
import { formatKwh, formatNgn } from "../context";

/**
 * USAGE — today + last 7 days kWh/₦ summary.
 */
export const usageHandler: CommandHandler = async (supabase, ctx) => {
  if (!ctx.wallet) {
    return { reply: "No usage yet — your meter isn't connected." };
  }

  const now = new Date();
  const todayStart = startOfDay(now).toISOString();
  const weekStart = startOfDay(subDays(now, 6)).toISOString();

  const { data: rows } = await supabase
    .from("transactions")
    .select("amount, kwh_consumed, created_at")
    .eq("wallet_id", ctx.wallet.id)
    .eq("type", "consumption")
    .gte("created_at", weekStart);

  let todayKwh = 0;
  let todaySpent = 0;
  let weekKwh = 0;
  let weekSpent = 0;
  for (const r of rows ?? []) {
    const amt = Math.abs(Number(r.amount ?? 0));
    const kwh = Number(r.kwh_consumed ?? 0);
    weekKwh += kwh;
    weekSpent += amt;
    if (r.created_at >= todayStart) {
      todayKwh += kwh;
      todaySpent += amt;
    }
  }

  return {
    reply: [
      `Today: ${formatKwh(todayKwh)} · ${formatNgn(todaySpent)}`,
      `Last 7 days: ${formatKwh(weekKwh)} · ${formatNgn(weekSpent)}`,
      "",
      `Balance: ${formatNgn(ctx.wallet.balance_kobo)}`,
    ].join("\n"),
  };
};
