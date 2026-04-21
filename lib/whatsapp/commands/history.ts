import "server-only";
import { format } from "date-fns";
import type { CommandHandler } from "./types";
import { formatNgn } from "../context";

/**
 * HISTORY — last 5 transactions across all types.
 */
export const historyHandler: CommandHandler = async (supabase, ctx) => {
  if (!ctx.wallet) {
    return { reply: "No transactions yet — your wallet is empty." };
  }
  const { data: rows } = await supabase
    .from("transactions")
    .select("type, amount, status, created_at")
    .eq("wallet_id", ctx.wallet.id)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!rows?.length) {
    return { reply: "No transactions yet." };
  }

  const lines = rows.map((r) => {
    const amt = Number(r.amount ?? 0);
    const sign = amt >= 0 ? "+" : "-";
    const abs = formatNgn(Math.abs(amt));
    const when = format(new Date(r.created_at), "d MMM HH:mm");
    const label = labelFor(String(r.type), amt);
    const statusTag = r.status === "success" ? "" : ` (${r.status})`;
    return `${when} · ${label}: ${sign}${abs}${statusTag}`;
  });

  return { reply: ["Last 5 transactions:", ...lines].join("\n") };
};

function labelFor(type: string, amount: number): string {
  switch (type) {
    case "topup":
      return "Top-up";
    case "consumption":
      return amount >= 0 ? "Earning" : "Usage";
    case "withdrawal":
      return "Withdrawal";
    case "platform_fee":
      return "Platform fee";
    case "installment":
      return "Installment";
    case "refund":
      return "Refund";
    default:
      return type;
  }
}
