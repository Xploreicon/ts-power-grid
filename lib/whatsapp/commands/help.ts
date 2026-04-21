import "server-only";
import type { CommandHandler } from "./types";

export const HELP_TEXT = [
  "T&S Power commands:",
  "",
  "• BAL — balance + today's usage",
  "• TOP 500 — top up ₦500 (Paystack link)",
  "• USAGE — today + last 7 days",
  "• PRICE — current rate per kWh",
  "• HISTORY — last 5 transactions",
  "• REPORT <issue> — raise a ticket",
  "• STOP — pause auto-reconnect",
  "• START — resume auto-reconnect",
  "• HELP — this message",
].join("\n");

export const helpHandler: CommandHandler = async () => ({ reply: HELP_TEXT });
