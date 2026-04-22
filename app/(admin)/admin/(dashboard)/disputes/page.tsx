import { createAdminClient } from "@/lib/supabase/admin";
import { DisputesTable } from "./disputes-table";

export const dynamic = "force-dynamic";

export default async function DisputesPage() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("disputes")
    .select(
      "id, category, status, description, created_at, assigned_to, raised_by, profiles:raised_by(full_name, phone)",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const rows: DisputeRow[] = (data ?? []).map((d) => {
    const p = (d.profiles as unknown) as {
      full_name: string | null;
      phone: string | null;
    } | null;
    return {
      id: d.id as string,
      raised_by_name: p?.full_name ?? null,
      raised_by_phone: p?.phone ?? null,
      category: (d.category as string | null) ?? null,
      status: (d.status as string | null) ?? null,
      description: (d.description as string | null) ?? null,
      created_at: d.created_at as string,
      assigned_to: (d.assigned_to as string | null) ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Disputes</h1>
        <p className="text-sm text-navy-700/70">
          Customer-raised issues awaiting triage.
        </p>
      </div>
      <DisputesTable rows={rows} />
    </div>
  );
}

export interface DisputeRow {
  id: string;
  raised_by_name: string | null;
  raised_by_phone: string | null;
  category: string | null;
  status: string | null;
  description: string | null;
  created_at: string;
  assigned_to: string | null;
}
