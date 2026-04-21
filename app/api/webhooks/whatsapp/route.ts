import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWhatsAppSignature } from "@/lib/whatsapp/client";
import { routeMessage } from "@/lib/whatsapp/router";
import { deliverMessage } from "@/lib/whatsapp/delivery";

export const runtime = "nodejs"; // crypto
export const dynamic = "force-dynamic";

/**
 * GET /api/webhooks/whatsapp
 *
 * Meta's webhook verification handshake. When we (re)configure the webhook
 * in the Meta dashboard, Meta hits this endpoint with ?hub.mode=subscribe
 * &hub.verify_token=<our token>&hub.challenge=<random>. We echo back the
 * challenge iff the verify token matches.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

/**
 * POST /api/webhooks/whatsapp
 *
 * Meta delivers inbound messages + status callbacks here. Delivery is
 * at-least-once, so handlers must be idempotent on wa_message_id.
 *
 * Flow:
 *   1. Verify HMAC-SHA256 signature on raw body.
 *   2. Parse; iterate entry[].changes[].value.messages[].
 *   3. For each text message: log inbound, route to a handler, reply.
 *   4. Always return 200 — non-200 makes Meta retry, usually pointlessly.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  const appSecret = process.env.WHATSAPP_APP_SECRET ?? "";
  const signatureValid = appSecret
    ? verifyWhatsAppSignature(rawBody, signature, appSecret)
    : false;

  // In production, reject bad signatures. In dev (no app secret), allow so
  // we can curl-test locally.
  if (appSecret && !signatureValid) {
    console.warn("[whatsapp-webhook] bad signature");
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 200 });
  }

  const admin = createAdminClient();

  // Fire-and-forget each message; failures logged, never thrown.
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;

      // 1. Status callbacks (sent/delivered/read/failed).
      for (const status of value.statuses ?? []) {
        await admin
          .from("whatsapp_messages")
          .update({
            status: status.status,
            error: status.errors?.[0]?.title ?? null,
          })
          .eq("wa_message_id", status.id);
      }

      // 2. Inbound messages.
      for (const msg of value.messages ?? []) {
        try {
          await handleInbound(admin, msg);
        } catch (err) {
          console.error(
            "[whatsapp-webhook] handleInbound failed:",
            err instanceof Error ? err.message : err,
          );
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}

async function handleInbound(
  admin: ReturnType<typeof createAdminClient>,
  msg: WhatsAppInboundMessage,
) {
  // Idempotency: skip if we've seen this wa_message_id already.
  const { data: seen } = await admin
    .from("whatsapp_messages")
    .select("id")
    .eq("wa_message_id", msg.id)
    .eq("direction", "inbound")
    .maybeSingle();
  if (seen) return;

  const phone = `+${msg.from}`; // Meta strips the '+' in `from`.
  const body = extractText(msg);

  await admin.from("whatsapp_messages").insert({
    direction: "inbound",
    phone,
    wa_message_id: msg.id,
    body,
    status: "received",
    provider: "whatsapp_cloud",
  });

  if (!body) return; // non-text (image/audio/sticker) — ignore v1.

  const result = await routeMessage(admin, {
    phone,
    body,
    waMessageId: msg.id,
  });

  if (result.rateLimited) return; // silently drop subsequent messages

  // Reply via the same WhatsApp session (inside 24h window, no template).
  await deliverMessage(admin, {
    phone,
    body: result.reply,
  });
}

function extractText(msg: WhatsAppInboundMessage): string {
  if (msg.type === "text") return msg.text?.body ?? "";
  if (msg.type === "button") return msg.button?.text ?? "";
  if (msg.type === "interactive") {
    return (
      msg.interactive?.button_reply?.title ??
      msg.interactive?.list_reply?.title ??
      ""
    );
  }
  return "";
}

// ---------------------------------------------------------------------------
// Meta webhook payload shapes (only the bits we use).
// ---------------------------------------------------------------------------

interface WhatsAppWebhookPayload {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        messaging_product?: string;
        metadata?: { phone_number_id?: string };
        messages?: WhatsAppInboundMessage[];
        statuses?: Array<{
          id: string;
          status: "sent" | "delivered" | "read" | "failed";
          errors?: Array<{ title?: string; code?: number }>;
        }>;
      };
    }>;
  }>;
}

interface WhatsAppInboundMessage {
  id: string;
  from: string;
  timestamp?: string;
  type: "text" | "image" | "audio" | "button" | "interactive" | string;
  text?: { body: string };
  button?: { text?: string; payload?: string };
  interactive?: {
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
}
