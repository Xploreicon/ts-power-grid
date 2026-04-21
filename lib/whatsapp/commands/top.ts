import "server-only";
import { randomUUID } from "crypto";
import { initializeTransaction } from "@/lib/paystack/client";
import type { CommandHandler } from "./types";
import { formatNgn } from "../context";

const MIN_TOPUP_KOBO = 10_000; // ₦100
const MAX_TOPUP_KOBO = 5_000_000; // ₦50,000

/**
 * TOP [amount] — generate a Paystack payment link for `amount` naira.
 *
 * Accepts "TOP 500", "TOP ₦500", "top 1,000". The amount is parsed as
 * naira (not kobo) because that matches the user's mental model.
 */
export const topHandler: CommandHandler = async (supabase, ctx, input) => {
  if (!ctx.profile) {
    return {
      reply:
        "Your account isn't set up yet. Ask your host to add your phone number.",
    };
  }

  const amountKobo = parseAmountKobo(input.args);
  if (!amountKobo) {
    return {
      reply:
        "Enter an amount, e.g. TOP 500 to top up ₦500. Minimum ₦100, maximum ₦50,000.",
    };
  }
  if (amountKobo < MIN_TOPUP_KOBO || amountKobo > MAX_TOPUP_KOBO) {
    return {
      reply: `Amount must be between ${formatNgn(MIN_TOPUP_KOBO)} and ${formatNgn(MAX_TOPUP_KOBO)}.`,
    };
  }

  // We need an email for Paystack. Fall back to a synthetic one if the
  // neighbor never provided one (phone-only sign-up).
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, phone")
    .eq("id", ctx.profile.id)
    .maybeSingle();

  const email =
    profile?.email ??
    `${(profile?.phone ?? ctx.senderPhone).replace(/\D/g, "")}@phone.tspowergrid.local`;

  const reference = `topup_${randomUUID()}`;

  // Persist pending transaction so webhook idempotency works.
  const { error: txErr } = await supabase.from("transactions").insert({
    wallet_id: ctx.wallet?.id,
    type: "topup",
    amount: amountKobo,
    reference,
    status: "pending",
    metadata: { provider: "paystack", initiator: "whatsapp" },
  });
  if (txErr) {
    return {
      reply:
        "Sorry, we couldn't create your top-up right now. Please try again in a minute.",
    };
  }

  const callbackUrl =
    process.env.PAYSTACK_CALLBACK_URL ??
    (process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/payments/callback`
      : undefined);

  try {
    const init = await initializeTransaction({
      email,
      amountKobo,
      reference,
      callbackUrl,
      metadata: {
        user_id: ctx.profile.id,
        type: "topup",
        source: "whatsapp",
      },
    });
    return {
      reply: [
        `Top up ${formatNgn(amountKobo)}:`,
        init.authorization_url,
        "",
        "The link works once. Reply BAL after paying to check your new balance.",
      ].join("\n"),
    };
  } catch {
    return {
      reply:
        "Payments are temporarily unavailable. Please try again in a few minutes.",
    };
  }
};

export function parseAmountKobo(raw: string): number | null {
  const digits = raw.replace(/[^\d.]/g, "");
  if (!digits) return null;
  const ngn = parseFloat(digits);
  if (!Number.isFinite(ngn) || ngn <= 0) return null;
  return Math.round(ngn * 100);
}
