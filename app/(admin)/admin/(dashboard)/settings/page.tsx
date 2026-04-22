import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { SettingsView } from "./settings-view";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireAdmin();
  const supabase = createAdminClient();

  const [{ data: team }, { data: config }, { data: templates }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, phone, role, created_at")
        .in("role", ["admin", "super_admin"])
        .order("created_at", { ascending: true }),
      supabase.from("platform_config").select("key, value, updated_at"),
      supabase
        .from("notification_templates")
        .select("id, channel, name, body, updated_at")
        .order("name", { ascending: true }),
    ]);

  return (
    <SettingsView
      role={session.role}
      team={team ?? []}
      config={config ?? []}
      templates={templates ?? []}
    />
  );
}
