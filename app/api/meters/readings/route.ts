import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  processReading,
  ReadingValidationError,
  ReadingProcessingError,
} from "@/lib/billing/engine";

/**
 * POST /api/meters/readings
 *
 * Gateway ingress for meter readings. Every request must carry:
 *   - Header `x-gateway-api-key`: the plaintext API key, sha256-compared
 *     against `gateways.api_key_hash`. Hash-only storage means a DB leak
 *     never exposes the key itself.
 *   - JSON body: { meter_id, cumulative_kwh, timestamp }
 *
 * Auth is gateway-scoped (not user-scoped), so the service-role client
 * is used. The billing engine guarantees idempotency and atomicity —
 * this route is a thin adapter.
 */

const bodySchema = z.object({
  meter_id: z.string().uuid(),
  cumulative_kwh: z.number().finite().nonnegative(),
  timestamp: z.string().datetime(),
});

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-gateway-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "missing_api_key" }, { status: 401 });
  }
  const keyHash = createHash("sha256").update(apiKey).digest("hex");

  const admin = createAdminClient();

  // Authenticate the gateway. We also enforce that the meter belongs to
  // the gateway that presented the key — prevents one gateway from
  // reporting readings on another gateway's meters.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", details: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const { meter_id, cumulative_kwh, timestamp } = parsed.data;

  const { data: meter, error: meterErr } = await admin
    .from("meters")
    .select("id, gateway_id, gateways:gateways!meters_gateway_id_fkey(api_key_hash)")
    .eq("id", meter_id)
    .maybeSingle();

  if (meterErr) {
    return NextResponse.json({ error: meterErr.message }, { status: 500 });
  }
  if (!meter) {
    return NextResponse.json({ error: "meter_not_found" }, { status: 404 });
  }

  const gwHash = (meter as unknown as { gateways: { api_key_hash: string | null } })
    .gateways?.api_key_hash;
  if (!gwHash || gwHash !== keyHash) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await processReading(admin, {
      meterId: meter_id,
      cumulativeKwh: cumulative_kwh,
      timestamp,
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    if (err instanceof ReadingValidationError) {
      return NextResponse.json(
        { error: "validation", message: err.message },
        { status: 422 },
      );
    }
    if (err instanceof ReadingProcessingError) {
      return NextResponse.json(
        { error: "processing", message: err.message },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
