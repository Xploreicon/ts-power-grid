import { createAdminClient } from "@/lib/supabase/admin";
import { LeadsTable } from "./leads-table";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("leads")
    .select(
      "id, name, phone, email, area, path_interest, status, assigned_to, created_at, notes",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Leads</h1>
        <p className="text-sm text-navy-700/70">
          Pipeline of prospective hosts and neighbors.
        </p>
      </div>
      <LeadsTable leads={(data ?? []) as Lead[]} />
    </div>
  );
}

export interface Lead {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  area: string | null;
  path_interest: string | null;
  status: string | null;
  assigned_to: string | null;
  created_at: string;
  notes: string | null;
}
