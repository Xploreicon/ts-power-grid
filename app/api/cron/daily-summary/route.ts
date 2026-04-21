import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDailySummary } from "@/lib/whatsapp/proactive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/daily-summary
 *
 * Fires at 20:00 Africa/Lagos (19:00 UTC) via Vercel Cron. Sends a one-line
 * summary to each neighbor who has opted in to daily summaries.
 *
 * Auth: Vercel Cron adds `Authorization: Bearer <CRON_SECRET>` automatically
 * when CRON_SECRET is set. We reject unauthenticated hits in production.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  const admin = createAdminClient();

  // Pull opted-in neighbors. notification_prefs->>daily_summary_opt_in = 'true'.
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "neighbor")
    .filter("notification_prefs->>daily_summary_opt_in", "eq", "true");

  if (error) {
    console.error("[cron/daily-summary] profile fetch failed:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  let sent = 0;
  let skipped = 0;

  for (const p of profiles ?? []) {
    try {
      const { data: wallet } = await admin
        .from("wallets")
        .select("id, balance_kobo")
        .eq("user_id", p.id)
        .maybeSingle();

      if (!wallet) {
        skipped++;
        continue;
      }

      const { data: txs } = await admin
        .from("transactions")
        .select("amount_kobo, kwh")
        .eq("wallet_id", wallet.id)
        .eq("type", "consumption")
        .gte("created_at", startOfDay.toISOString());

      const kwhToday = (txs ?? []).reduce(
        (s, t) => s + Number(t.kwh ?? 0),
        0,
      );
      const spentKoboToday = (txs ?? []).reduce(
        (s, t) => s + Math.abs(Number(t.amount_kobo ?? 0)),
        0,
      );

      await sendDailySummary(admin, p.id, {
        kwhToday,
        spentKoboToday,
        balanceKobo: Number(wallet.balance_kobo ?? 0),
      });
      sent++;
    } catch (err) {
      console.error(
        "[cron/daily-summary] failed for user",
        p.id,
        err instanceof Error ? err.message : err,
      );
      skipped++;
    }
  }

  return NextResponse.json({ ok: true, sent, skipped });
}
