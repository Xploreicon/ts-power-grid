import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPaystackSignature } from "@/lib/paystack/signature";
import { verifyTransaction } from "@/lib/paystack/client";
import { processChargeSuccess } from "@/lib/paystack/process-charge";
import {
  handleTransferFailed,
  handleTransferSuccess,
} from "@/lib/paystack/withdrawal";

export const runtime = "nodejs"; // crypto required
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/paystack
 *
 * Delivery guarantees Paystack gives us: at-least-once, retries up to 72h.
 * Our job:
 *   1. Verify signature on RAW body (HMAC-SHA512).
 *   2. Log the event regardless of outcome (audit trail).
 *   3. Dispatch to the right handler — all of which are idempotent.
 *   4. Return 200 quickly. Non-200 triggers Paystack retries.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  const webhookSecret =
    process.env.PAYSTACK_WEBHOOK_SECRET ?? process.env.PAYSTACK_SECRET_KEY;
  if (!webhookSecret) {
    // Don't echo this to Paystack in prod, but do log so ops notices.
    console.error("[paystack-webhook] webhook secret not configured");
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const signatureValid = verifyPaystackSignature(
    rawBody,
    signature,
    webhookSecret,
  );

  let payload: {
    event?: string;
    data?: { reference?: string; id?: number | string };
  } = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: logged } = await admin
    .from("paystack_webhook_events")
    .insert({
      event_type: payload.event ?? "unknown",
      reference: payload.data?.reference ?? null,
      paystack_id: payload.data?.id != null ? String(payload.data.id) : null,
      signature_valid: signatureValid,
      payload,
    })
    .select("id")
    .maybeSingle();
  const logId = logged?.id;

  if (!signatureValid) {
    // Acknowledge — returning 401 would make Paystack retry forever.
    return NextResponse.json({ ok: false, error: "bad signature" }, { status: 200 });
  }

  try {
    await dispatch(admin, payload);
    if (logId) {
      await admin
        .from("paystack_webhook_events")
        .update({ processed_at: new Date().toISOString() })
        .eq("id", logId);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "handler error";
    console.error("[paystack-webhook] handler failed:", message);
    if (logId) {
      await admin
        .from("paystack_webhook_events")
        .update({
          processing_error: message.slice(0, 500),
          processed_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }
    // Still 200 — we've logged; don't trigger infinite Paystack retries on
    // deterministic handler bugs. Manual replay uses the events table.
  }

  return NextResponse.json({ ok: true });
}

async function dispatch(
  admin: ReturnType<typeof createAdminClient>,
  payload: { event?: string; data?: Record<string, unknown> },
) {
  const event = payload.event;
  const data = (payload.data ?? {}) as Record<string, unknown>;

  switch (event) {
    case "charge.success": {
      // Webhook payload's shape matches VerifyTransactionResult closely, but
      // to be safe we re-verify against Paystack. This protects against a
      // forged webhook sneaking past signature check (defence in depth).
      const reference = data.reference as string | undefined;
      if (!reference) return;
      const tx = await verifyTransaction(reference);
      if (tx.status !== "success") return;
      await processChargeSuccess(admin, tx);
      return;
    }
    case "transfer.success": {
      const reference = data.reference as string | undefined;
      const transferCode = data.transfer_code as string | undefined;
      if (!reference) return;
      await handleTransferSuccess(admin, { reference, transfer_code: transferCode });
      return;
    }
    case "transfer.failed":
    case "transfer.reversed": {
      const reference = data.reference as string | undefined;
      const reason =
        (data.reason as string | undefined) ??
        (data.failure_reason as string | undefined) ??
        `Paystack ${event}`;
      if (!reference) return;
      await handleTransferFailed(admin, { reference, reason });
      return;
    }
    default:
      // Unknown/unhandled events are logged but not processed.
      return;
  }
}
