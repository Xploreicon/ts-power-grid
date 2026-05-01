import { NextResponse, type NextRequest } from "next/server";
import { handleUpdate } from "@/lib/telegram/bot";
import { verifyTelegramSecret } from "@/lib/telegram/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/telegram
 *
 * Telegram delivers updates here. Auth is the secret_token we passed
 * to `setWebhook` at deploy time, echoed back on every request as the
 * `X-Telegram-Bot-Api-Secret-Token` header. We compare in constant
 * time and 200 the request either way — Telegram retries on 5xx, and
 * an attacker who tripped the auth check has nothing to gain from a
 * 403.
 *
 * Webhook payloads are short-lived (seconds), so we process them
 * inline and return immediately. Long-running work (broker round-
 * trips during /top, dispute creation during /report) happens inside
 * `handleUpdate` and we await it — Telegram tolerates up to 60s
 * before considering the request failed.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  const header = req.headers.get("x-telegram-bot-api-secret-token");

  // In production we require the secret; in dev (no secret set) we
  // accept anything so curl-tests work.
  if (secret && !verifyTelegramSecret(header, secret)) {
    console.warn("[telegram-webhook] bad secret_token");
    return NextResponse.json({ ok: true });
  }

  let update: unknown;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" });
  }

  try {
    await handleUpdate(update);
  } catch (err) {
    console.error("[telegram-webhook] handleUpdate failed:", err);
    // Still 200 — Telegram retries on non-2xx, and a transient bug
    // shouldn't stack up retries that all crash the same way.
  }

  return NextResponse.json({ ok: true });
}

/**
 * GET /api/webhooks/telegram
 *
 * Lightweight health probe so deploy scripts can sanity-check the
 * route is wired before they call setWebhook on Telegram's side.
 */
export async function GET() {
  return NextResponse.json({ ok: true, channel: "telegram" });
}
