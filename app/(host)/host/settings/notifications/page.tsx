import { createClient } from "@/lib/supabase/server";
import { NotificationsView } from "./notifications-view";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HostNotificationsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", user.id)
    .single();

  const preferences = profile?.preferences || {};

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-2 font-display text-2xl font-bold text-navy-950">
        Notification Preferences
      </h1>
      <p className="mb-8 text-sm text-navy-700/70">
        Choose how you want to be notified about activity on your sites.
      </p>

      <NotificationsView initialPreferences={preferences as Record<string, boolean>} />
    </div>
  );
}
