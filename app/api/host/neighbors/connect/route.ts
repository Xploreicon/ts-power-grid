import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWelcomeMessage } from "@/lib/messaging";
import { sendSms } from "@/lib/termii/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/host/neighbors/connect
 *
 * Server-side wrapper around the `connect_neighbor` RPC. Two outcomes:
 *
 *   1. The phone resolves to an existing profile → connection is
 *      created with status='active' and the neighbor gets the
 *      conversational welcome (Telegram or WhatsApp depending on
 *      MESSAGING_CHANNEL).
 *   2. The phone does NOT resolve → connection is created with
 *      status='pending' and the phone is stashed in
 *      `connections.pending_phone`. We send a one-shot SMS invite
 *      pointing them at the Telegram bot / sign-up page. When they
 *      sign up, `claim_pending_connection` flips the row to active.
 *
 * Either way the host's UX is identical — they don't need to wait for
 * the neighbor to register before connecting them.
 */

const bodySchema = z.object({
  neighborPhone: z.string().min(7),
  meterId: z.string().uuid(),
  pricePerKwh: z.number().min(10).max(1000),
});

export async function POST(req: NextRequest) {
  const session = createServerClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad_request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { neighborPhone, meterId, pricePerKwh } = parsed.data;

  // RPC handles both branches (active vs pending) — the only failures
  // we expect now are "host == neighbor", "meter doesn't exist", or a
  // genuine DB issue. The "no profile" rejection from the old version
  // is gone; pending rows replace it.
  const admin = createAdminClient();
  const { data: connectionId, error: rpcErr } = await admin.rpc(
    "connect_neighbor",
    {
      p_host_id: user.id,
      p_neighbor_phone: neighborPhone,
      p_meter_id: meterId,
      p_price_per_kwh: pricePerKwh,
    },
  );
  if (rpcErr) {
    const lower = rpcErr.message?.toLowerCase() ?? "";
    const code = lower.includes("same user")
      ? "self_connection"
      : lower.includes("meter")
        ? "meter_unavailable"
        : "rpc_failed";
    return NextResponse.json(
      { error: code, message: rpcErr.message },
      { status: 400 },
    );
  }

  const { data: neighbor } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("phone", neighborPhone)
    .maybeSingle();

  const { data: hostProfile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const hostName = hostProfile?.full_name ?? "your host";

  // Branch on whether a profile already existed. We can't tell from
  // the RPC's return value alone (it returns a uuid in both cases) so
  // we re-check by phone — same query the RPC's own SELECT runs.
  if (neighbor?.id) {
    sendWelcomeMessage(admin, neighbor.id, {
      hostName,
      pricePerKwh,
    }).catch((err) => {
      console.error("[connect-neighbor] welcome send failed:", err);
    });
    return NextResponse.json({
      connectionId,
      status: "active",
      ok: true,
    });
  }

  // Pending branch — fire a single-shot SMS invite. Telegram isn't an
  // option here because the recipient hasn't started the bot (the
  // whole point: they have no account yet). Termii is already wired
  // and gives delivery receipts in the dashboard if a host complains
  // their neighbour didn't get the SMS.
  const inviteBody = composeInviteSms({ hostName, pricePerKwh });
  sendSms({ to: neighborPhone, sms: inviteBody }).catch((err) => {
    console.error("[connect-neighbor] invite SMS failed:", err);
  });

  return NextResponse.json({
    connectionId,
    status: "pending",
    ok: true,
  });
}

/**
 * One-shot SMS for an invited-but-not-yet-signed-up neighbour. Keeps
 * to ~160 chars so it fits a single GSM-7 segment (Termii bills per
 * segment). Telegram link is preferred when configured because the
 * neighbour's day-to-day balance / top-up commands live there.
 */
function composeInviteSms(opts: {
  hostName: string;
  pricePerKwh: number;
}): string {
  const bot = process.env.TELEGRAM_BOT_USERNAME;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const ngn = `₦${opts.pricePerKwh}/kWh`;
  if (bot) {
    return (
      `${opts.hostName} invited you to share solar power on T&S Power Grid at ${ngn}. ` +
      `Tap https://t.me/${bot} and press Start to set up your account.`
    );
  }
  return (
    `${opts.hostName} invited you to share solar power on T&S Power Grid at ${ngn}. ` +
    `Sign up at ${appUrl || "https://ts-power-grid.vercel.app"}/sign-up to activate.`
  );
}
