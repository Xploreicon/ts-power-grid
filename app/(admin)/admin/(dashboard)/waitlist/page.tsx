import { createAdminClient } from "@/lib/supabase/admin";
import { WaitlistDashboard } from "./waitlist-dashboard";
import type { WaitlistSubmission } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function WaitlistPage() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("waitlist_submissions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Waitlist</h1>
        <p className="text-sm text-navy-700/70">
          Public waitlist submissions from prospective hosts.
        </p>
      </div>
      <WaitlistDashboard submissions={(data ?? []) as WaitlistSubmission[]} />
    </div>
  );
}
