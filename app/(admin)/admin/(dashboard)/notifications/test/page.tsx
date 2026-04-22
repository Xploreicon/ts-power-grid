import { createAdminClient } from "@/lib/supabase/admin";
import { TestView } from "./test-view";

export const dynamic = "force-dynamic";

export default async function NotificationTestPage() {
  const supabase = createAdminClient();

  const { data: users } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Test Notifications</h1>
        <p className="text-sm text-navy-700/70">
          Super Admin utility to dispatch simulated events for QA.
        </p>
      </div>
      <TestView users={users || []} />
    </div>
  );
}
