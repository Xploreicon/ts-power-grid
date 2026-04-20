/**
 * Thin Termii REST wrapper for transactional SMS (plain send, not Termii's
 * managed OTP endpoint — we generate our own codes so we can fall back to
 * Supabase if Termii is down).
 *
 * Docs: https://developer.termii.com/messaging-api
 */

const TERMII_BASE = "https://api.ng.termii.com/api";

export class TermiiError extends Error {
  constructor(message: string, readonly status?: number, readonly body?: unknown) {
    super(message);
    this.name = "TermiiError";
  }
}

interface SendSmsArgs {
  to: string; // E.164, no leading +
  sms: string;
  senderId?: string;
}

/** Send a plain SMS via Termii. Throws TermiiError on any non-success. */
export async function sendSms({ to, sms, senderId }: SendSmsArgs): Promise<void> {
  const apiKey = process.env.TERMII_API_KEY;
  const from = senderId ?? process.env.TERMII_SENDER_ID ?? "N-Alert";
  if (!apiKey) {
    throw new TermiiError("TERMII_API_KEY not configured");
  }

  // Termii expects the recipient without a leading +, but with country code.
  const recipient = to.replace(/^\+/, "");

  const res = await fetch(`${TERMII_BASE}/sms/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      to: recipient,
      from,
      sms,
      type: "plain",
      channel: "generic",
    }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    message_id?: string;
    message?: string;
    code?: string;
  };

  if (!res.ok || !json.message_id) {
    throw new TermiiError(
      json.message ?? `Termii send failed (${res.status})`,
      res.status,
      json,
    );
  }
}

/** Convenience helper — formats the OTP message and sends. */
export async function sendOtpSms(phoneE164: string, code: string): Promise<void> {
  const msg = `${code} is your T&S Power Grid verification code. Valid for 5 minutes. Do not share.`;
  await sendSms({ to: phoneE164, sms: msg });
}
