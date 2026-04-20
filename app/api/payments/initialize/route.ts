import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { initializeTransaction } from "@/lib/paystack/client";
import { clientIp, rateLimit } from "@/lib/paystack/rate-limit";
import { randomUUID } from "crypto";

const schema = z.object({
  type: z.enum(["topup", "installment", "installation"]),
  amount_kobo: z.number().int().min(100),
  installment_id: z.string().uuid().optional(),
  site_id: z.string().uuid().optional(),
});

/**
 * POST /api/payments/initialize
 *
 * Generates a server-owned reference, persists a pending transaction row so
 * the webhook + verify endpoints have something to idempotently correlate,
 * then returns Paystack's authorization_url for the client to redirect to.
 *
 * Authenticated: reads user from Supabase session cookie.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);
  const rl = rateLimit(`init:${ip}`, 30, 60_000);
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
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400 },
    );
  }
  const { type, amount_kobo, installment_id, site_id } = parsed.data;

  if (type === "installment" && !installment_id) {
    return NextResponse.json(
      { error: "installment_id required for installment payments" },
      { status: 400 },
    );
  }
  if (type === "installation" && !site_id) {
    return NextResponse.json(
      { error: "site_id required for installation payments" },
      { status: 400 },
    );
  }

  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.email) {
    return NextResponse.json(
      { error: "Email required to initialise payment. Update your profile." },
      { status: 400 },
    );
  }

  const reference = `${type}_${randomUUID()}`;

  // Persist a pending Paystack transaction record. For topups we write into
  // wallets.transactions (schema path: requires a wallet). For installments
  // and installation we use the Paystack webhook events log via metadata and
  // defer persistence until verify.
  if (type === "topup") {
    const { data: wallet } = await admin
      .from("wallets")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!wallet) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 400 });
    }
    const { error: txErr } = await admin.from("transactions").insert({
      wallet_id: wallet.id,
      type: "topup",
      amount: amount_kobo,
      reference,
      status: "pending",
      metadata: { provider: "paystack", initiator: "user" },
    });
    if (txErr) {
      // Unique ref collision would only happen if randomUUID clashes — surface it.
      return NextResponse.json(
        { error: `Could not create pending transaction: ${txErr.message}` },
        { status: 500 },
      );
    }
  }

  const callbackUrl =
    process.env.PAYSTACK_CALLBACK_URL ??
    (process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/payments/callback`
      : undefined);

  try {
    const init = await initializeTransaction({
      email: profile.email,
      amountKobo: amount_kobo,
      reference,
      callbackUrl,
      metadata: {
        user_id: user.id,
        type,
        installment_id,
        site_id,
      },
    });
    return NextResponse.json({
      reference: init.reference,
      authorization_url: init.authorization_url,
      access_code: init.access_code,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Paystack error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
