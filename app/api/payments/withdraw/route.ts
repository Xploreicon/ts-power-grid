import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processWithdrawal } from "@/lib/paystack/withdrawal";
import { clientIp, rateLimit } from "@/lib/paystack/rate-limit";
import { MIN_WITHDRAWAL_KOBO } from "@/lib/billing/config";

const schema = z.object({
  amount_kobo: z.number().int().min(MIN_WITHDRAWAL_KOBO),
});

/**
 * POST /api/payments/withdraw
 *
 * Initiates a Paystack transfer to the host's bank account. Called by the
 * host PWA's WithdrawFlow. Funds are held (not debited) until Paystack's
 * transfer.success webhook flips the transaction to success and debits.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);
  const rl = rateLimit(`withdraw:${ip}`, 5, 60_000);
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

  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  try {
    const result = await processWithdrawal(admin, {
      userId: user.id,
      amountKobo: parsed.data.amount_kobo,
    });
    return NextResponse.json({
      withdrawalId: result.withdrawalId,
      transferReference: result.transferReference,
      status: "pending",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Withdrawal failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
