import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

const OFFLINE_THRESHOLD_MS = 30 * 60 * 1000;

type DerivedStatus = "online" | "offline" | "faulty";

function deriveStatus(
  statusColumn: string | null,
  lastSeenAt: string | null,
): DerivedStatus {
  if (statusColumn === "faulty") return "faulty";
  if (!lastSeenAt) return "offline";
  if (Date.now() - new Date(lastSeenAt).getTime() > OFFLINE_THRESHOLD_MS)
    return "offline";
  return "online";
}

/**
 * GET /api/admin/gateways?status=online|offline|faulty&q=search
 * Returns fleet with derived live status. Server-side filtering of the
 * derived status so pagination reflects post-filter counts.
 */
export async function GET(req: Request) {
  await requireAdmin();
  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status");
  const q = (url.searchParams.get("q") ?? "").trim();

  const supabase = createAdminClient();
  let query = supabase
    .from("gateways")
    .select(
      "id, serial_number, hardware_version, firmware_version, last_seen_at, status, site_id, sites:site_id(address, profiles:host_id(full_name))",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (q) {
    // Search is intentionally narrow: serial_number is the indexed column.
    // Address search would require a join filter; keep the cheap path here.
    query = query.ilike("serial_number", `%${q}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []).map((g) => {
    const site = (g.sites as unknown) as
      | { address: string | null; profiles: { full_name: string | null } | null }
      | null;
    const derived = deriveStatus(
      (g.status as string | null) ?? null,
      (g.last_seen_at as string | null) ?? null,
    );
    return {
      id: g.id as string,
      serial_number: g.serial_number as string,
      site_id: g.site_id as string,
      site_address: site?.address ?? null,
      host_name: site?.profiles?.full_name ?? null,
      firmware_version: (g.firmware_version as string | null) ?? null,
      hardware_version: (g.hardware_version as string | null) ?? null,
      last_seen_at: (g.last_seen_at as string | null) ?? null,
      status: derived,
    };
  });

  const filtered =
    statusFilter && ["online", "offline", "faulty"].includes(statusFilter)
      ? rows.filter((r) => r.status === statusFilter)
      : rows;

  return NextResponse.json({ gateways: filtered });
}
