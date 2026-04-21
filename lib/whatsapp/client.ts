import "server-only";
import crypto from "crypto";

/**
 * Thin wrapper around WhatsApp Business Cloud API (Meta).
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * We do not store the access token in this module — it's read from env at
 * send time so rotating the token doesn't require a restart.
 *
 * All numbers in E.164 (e.g. +2348012345678). Meta expects the leading '+'
 * dropped in the `to` field of the payload; we handle that internally.
 */

const GRAPH_BASE = "https://graph.facebook.com/v20.0";

export class WhatsAppError extends Error {
  status: number;
  providerMessage: string;
  constructor(status: number, providerMessage: string) {
    super(`WhatsApp ${status}: ${providerMessage}`);
    this.name = "WhatsAppError";
    this.status = status;
    this.providerMessage = providerMessage;
  }
}

export class WhatsAppConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WhatsAppConfigError";
  }
}

interface Config {
  phoneNumberId: string;
  accessToken: string;
  appSecret: string;
}

function loadConfig(): Config {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const appSecret = process.env.WHATSAPP_APP_SECRET ?? "";
  if (!phoneNumberId || !accessToken) {
    throw new WhatsAppConfigError(
      "WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN must be set",
    );
  }
  return { phoneNumberId, accessToken, appSecret };
}

/**
 * Normalise any Nigerian phone-ish input to E.164. Accepts:
 *   +2348012345678, 2348012345678, 08012345678, 8012345678
 * Returns null if we can't confidently parse.
 */
export function toE164Nigeria(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("234") && digits.length === 13) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11)
    return `+234${digits.slice(1)}`;
  if (digits.length === 10) return `+234${digits}`;
  if (input.startsWith("+") && digits.length >= 11) return `+${digits}`;
  return null;
}

async function request<T>(
  path: string,
  init: RequestInit,
  cfg: Config = loadConfig(),
): Promise<T> {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new WhatsAppError(res.status, "Invalid JSON from WhatsApp API");
  }
  if (!res.ok) {
    const err = body as { error?: { message?: string } };
    throw new WhatsAppError(
      res.status,
      err?.error?.message ?? `Request to ${path} failed`,
    );
  }
  return body as T;
}

type SendTextResult = {
  messaging_product: "whatsapp";
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
};

/**
 * Send a plain text message. Only works inside the 24-hour service window
 * (since the user last messaged us). For business-initiated messages
 * outside the window, use `sendTemplate`.
 */
export async function sendMessage(
  toPhone: string,
  text: string,
): Promise<{ messageId: string }> {
  const cfg = loadConfig();
  const to = normalisedTo(toPhone);
  const data = await request<SendTextResult>(
    `/${cfg.phoneNumberId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text.slice(0, 4096), preview_url: true },
      }),
    },
    cfg,
  );
  return { messageId: data.messages?.[0]?.id ?? "" };
}

/**
 * Send an approved WhatsApp template. `variables` map to {{1}}, {{2}}, ...
 * in the template's body.
 */
export async function sendTemplate(
  toPhone: string,
  templateName: string,
  variables: string[],
  languageCode = "en",
): Promise<{ messageId: string }> {
  const cfg = loadConfig();
  const to = normalisedTo(toPhone);
  const components = variables.length
    ? [
        {
          type: "body",
          parameters: variables.map((v) => ({ type: "text", text: v })),
        },
      ]
    : [];
  const data = await request<SendTextResult>(
    `/${cfg.phoneNumberId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components,
        },
      }),
    },
    cfg,
  );
  return { messageId: data.messages?.[0]?.id ?? "" };
}

function normalisedTo(phone: string): string {
  const e164 = toE164Nigeria(phone);
  if (!e164) throw new WhatsAppError(400, `Invalid phone: ${phone}`);
  // Meta wants no leading '+' on the `to` field.
  return e164.slice(1);
}

/**
 * Verify a webhook payload came from Meta. Meta signs the raw request body
 * with HMAC-SHA256 using the app secret, then prefixes "sha256=".
 * Header: x-hub-signature-256.
 */
export function verifyWhatsAppSignature(
  rawBody: string,
  header: string | null,
  appSecret: string,
): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");
  const actual = header.slice("sha256=".length);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(actual, "hex"),
    );
  } catch {
    return false;
  }
}
