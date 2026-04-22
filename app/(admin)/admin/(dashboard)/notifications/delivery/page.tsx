import { createAdminClient } from "@/lib/supabase/admin";
import { DeliveryView } from "./delivery-view";

export const dynamic = "force-dynamic";

export default async function NotificationDeliveryPage() {
  const supabase = createAdminClient();

  const { data: deliveries } = await supabase
    .from("notification_deliveries")
    .select("id, event_type, channel, status, error_message, created_at, user_id, profiles(email, phone)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Delivery Logs</h1>
        <p className="text-sm text-navy-700/70">
          Recent notification dispatches across all channels.
        </p>
      </div>
      <DeliveryView deliveries={deliveries || []} />
    </div>
  );
}
