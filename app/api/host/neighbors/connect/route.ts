import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWelcomeMessage } from "@/lib/messaging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/host/neighbors/connect
 *
 * Server-side wrapper around the `connect_neighbor` RPC that fires off
 * the welcome message on the active channel (Telegram by default in
 * 2026; WhatsApp on legacy deployments). Doing it here — rather than
 * client-side — keeps the messaging credentials out of the browser
 * and avoids a separate round-trip the host has to wait for.
 *
 * The welcome send is fire-and-forget: a transient Termii blip
 * shouldn't prevent the neighbor from being connected. Failures land
 * in `whatsapp_messages` (status='failed') so we can retry from the
 * admin dashboard.
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

  // 1. Run the RPC. We use the admin client so the welcome send below
  //    has a service-role connection ready; the RPC's own auth check
  //    is keyed on `p_host_id` which we pass explicitly.
  const admin = createAdminClient();
  const { error: rpcErr } = await admin.rpc("connect_neighbor", {
    p_host_id: user.id,
    p_neighbor_phone: neighborPhone,
    p_meter_id: meterId,
    p_price_per_kwh: pricePerKwh,
  });
  if (rpcErr) {
    const code =
      rpcErr.message?.toLowerCase().includes("profile") ? "neighbor_not_found"
        : rpcErr.message?.toLowerCase().includes("meter") ? "meter_unavailable"
          : "rpc_failed";
    return NextResponse.json(
      { error: code, message: rpcErr.message },
      { status: 400 },
    );
  }

  // 2. Look up the freshly-connected neighbor's userId so we can fire
  //    the welcome message. The connect_neighbor RPC creates the
  //    connection but doesn't return it — read it back.
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

  if (neighbor?.id) {
    // Fire-and-forget — failures logged but never block the response.
    sendWelcomeMessage(admin, neighbor.id, {
      hostName: hostProfile?.full_name ?? "your host",
      pricePerKwh,
    }).catch((err) => {
      console.error("[connect-neighbor] welcome send failed:", err);
    });
  }

  return NextResponse.json({ ok: true });
}
