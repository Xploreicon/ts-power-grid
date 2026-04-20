import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { resolveAccount } from "@/lib/paystack/client";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/paystack/rate-limit";

const schema = z.object({
  account_number: z.string().regex(/^\d{10}$/, "10-digit NUBAN required"),
  bank_code: z.string().min(2).max(10),
});

/**
 * GET /api/paystack/resolve-account?account_number=...&bank_code=...
 *
 * Auth required (any logged-in user). Rate-limited to 20/min per IP —
 * Paystack penalises abuse of this endpoint.
 */
export async function GET(req: NextRequest) {
  const ip = clientIp(req.headers);
  const rl = rateLimit(`resolve:${ip}`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const url = new URL(req.url);
  const parsed = schema.safeParse({
    account_number: url.searchParams.get("account_number") ?? "",
    bank_code: url.searchParams.get("bank_code") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid query" },
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

  try {
    const resolved = await resolveAccount(
      parsed.data.account_number,
      parsed.data.bank_code,
    );
    return NextResponse.json({
      account_number: resolved.account_number,
      account_name: resolved.account_name,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Resolve failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
