import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTransaction } from "@/lib/paystack/client";
import { processChargeSuccess } from "@/lib/paystack/process-charge";
import { clientIp, rateLimit } from "@/lib/paystack/rate-limit";

const schema = z.object({ reference: z.string().min(4).max(128) });

/**
 * POST /api/payments/verify
 *
 * Called by the client after Paystack redirects back. Asks Paystack for the
 * authoritative status, then hands success cases to processChargeSuccess
 * (shared with the webhook handler, so running both is idempotent).
 *
 * Rate-limited 10/min per IP to blunt reference-scraping.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);
  const rl = rateLimit(`verify:${ip}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "reference required" }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const tx = await verifyTransaction(parsed.data.reference);
    if (tx.status !== "success") {
      return NextResponse.json({
        status: tx.status,
        reference: tx.reference,
        gatewayResponse: tx.gateway_response,
      });
    }
    const admin = createAdminClient();
    const result = await processChargeSuccess(admin, tx);
    return NextResponse.json({
      status: "success",
      reference: tx.reference,
      amountKobo: tx.amount,
      type: result.type,
      handled: result.handled,
      note: result.note,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
