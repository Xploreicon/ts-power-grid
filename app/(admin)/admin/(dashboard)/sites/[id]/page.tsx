import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { SiteDetailView } from "./site-detail-view";
import { CopyableId } from "./copyable-id";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function SiteDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createAdminClient();

  // Diagnostic short-circuit — when the URL segment isn't a valid uuid
  // (e.g. someone typo'd it) we render a friendly notice instead of a
  // bare 404. Same for "no row matches this uuid", below. The point is
  // that an operator hitting this URL gets enough information to know
  // whether they're looking at a routing bug or a data problem.
  if (!UUID_RE.test(params.id)) {
    return <SiteMissing reason="malformed_uuid" id={params.id} />;
  }

  const { data: site } = await supabase
    .from("sites")
    .select(
      "id, host_id, address, installation_type, status, installed_at, solar_capacity_kw, battery_capacity_kwh, latitude, longitude, profiles:host_id(id, full_name, phone, email, kyc_status)",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!site) {
    return <SiteMissing reason="not_in_db" id={params.id} />;
  }

  // Site → gateways → meters is a two-step lookup. The previous version
  // tried `meters.gateway_id = site.id` which always returned empty —
  // gateway_id is a uuid, site.id is a different uuid, they never match.
  // Resolve gateways first, then meters via the gateway IDs.
  const { data: gatewayRows } = await supabase
    .from("gateways")
    .select(
      "id, serial_number, status, hardware_version, firmware_version, last_seen_at",
    )
    .eq("site_id", params.id)
    .order("created_at", { ascending: true });
  const gateways = gatewayRows ?? [];
  const gatewayIds = gateways.map((g) => g.id as string);

  const [meters, connections, installments] = await Promise.all([
    gatewayIds.length
      ? supabase
          .from("meters")
          .select(
            "id, gateway_id, serial_number, meter_type, modbus_address, driver, status, last_reading_kwh, user_id",
          )
          .in("gateway_id", gatewayIds)
          .order("modbus_address", { ascending: true, nullsFirst: false })
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from("connections")
      .select(
        "id, neighbor_id, current_price_per_kwh, status, started_at, profiles:neighbor_id(full_name, phone)",
      )
      .eq("site_id", params.id),
    supabase
      .from("installments")
      .select("id, installment_number, amount, status, due_date, paid_at")
      .eq("site_id", params.id)
      .order("installment_number", { ascending: true }),
  ]);

  // Audit rows are keyed by meter_id, so scope to this site's meters.
  // Empty array → no rows fetched, which is the correct answer for a
  // site that has no meters yet.
  const meterRows = (meters.data ?? []) as Array<{ id: string }>;
  const meterIds = meterRows.map((m) => m.id);
  const { data: audit } = meterIds.length
    ? await supabase
        .from("billing_audit")
        .select("id, event_type, details, created_at, meter_id")
        .in("meter_id", meterIds)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] as never[] };

  return (
    <SiteDetailView
      siteId={params.id}
      site={site as never}
      gateways={gateways as never}
      meters={(meters.data ?? []) as never}
      connections={(connections.data ?? []) as never}
      billingAudit={(audit ?? []) as never}
      installments={(installments.data ?? []) as never}
    />
  );
}

/**
 * Rendered when either the URL segment isn't a valid uuid or no row in
 * `public.sites` matches it. Seeing this confirms the route + layout +
 * middleware stack reached the page handler — which lets us
 * distinguish "data missing" (this view) from "route broken" (Next's
 * default 404).
 */
function SiteMissing({
  reason,
  id,
}: {
  reason: "malformed_uuid" | "not_in_db";
  id: string;
}) {
  const title =
    reason === "malformed_uuid" ? "Not a valid site UUID" : "Site not found";
  const body =
    reason === "malformed_uuid"
      ? "The path segment isn't a uuid. Check the link."
      : "No row in public.sites matches this id. Sites are created by hosts via onboarding — see /admin/sites for the list of provisioned sites.";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber/30 bg-amber/10 p-5">
        <h1 className="font-display text-xl font-semibold text-navy-950">
          {title}
        </h1>
        <p className="mt-1 text-sm text-navy-700">{body}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-navy-700/70">Requested:</span>
          <CopyableId id={id} />
        </div>
        <div className="mt-4">
          <Link
            href="/admin/sites"
            className="inline-flex items-center rounded-lg border border-navy-100 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-offwhite"
          >
            ← Back to sites
          </Link>
        </div>
      </div>
    </div>
  );
}
