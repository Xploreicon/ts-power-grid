import { createAdminClient } from "@/lib/supabase/admin";
import { InstallationsView } from "./installations-view";
import { type InstallationRow } from "./types";

export const dynamic = "force-dynamic";

export default async function InstallationsPage() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("installations")
    .select(
      "id, stage, path_type, area, customer_name, scheduled_at, assigned_technician, amount, updated_at, created_at",
    )
    .order("updated_at", { ascending: false })
    .limit(500);

  const rows: InstallationRow[] = (data ?? []).map((i) => ({
    id: i.id as string,
    stage: (i.stage as string) ?? "lead_qualified",
    path_type: (i.path_type as string | null) ?? null,
    area: (i.area as string | null) ?? null,
    customer_name: (i.customer_name as string | null) ?? null,
    scheduled_at: (i.scheduled_at as string | null) ?? null,
    assigned_technician: (i.assigned_technician as string | null) ?? null,
    amount_kobo: Number(i.amount ?? 0),
    updated_at: (i.updated_at as string) ?? (i.created_at as string),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Installations</h1>
          <p className="text-sm text-navy-700/70">
            Pipeline of sites moving from lead to active.
          </p>
        </div>
      </div>
      <InstallationsView rows={rows} />
    </div>
  );
}

