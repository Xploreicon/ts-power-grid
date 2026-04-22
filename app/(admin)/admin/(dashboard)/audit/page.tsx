import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuditView } from "./audit-view";

export const dynamic = "force-dynamic";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: { event?: string; actor?: string };
}) {
  const session = await requireAdmin();
  if (session.role !== "super_admin") {
    redirect("/admin");
  }

  const supabase = createAdminClient();

  let query = supabase
    .from("billing_audit")
    .select("id, event_type, actor_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (searchParams.event) {
    query = query.eq("event_type", searchParams.event);
  }
  if (searchParams.actor) {
    query = query.eq("actor_id", searchParams.actor);
  }

  const { data: events } = await query;

  // Pull actor names for the rows we have.
  const actorIds = Array.from(
    new Set((events ?? []).map((e) => e.actor_id).filter(Boolean)),
  );
  const { data: actors } = actorIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", actorIds)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };

  const actorMap = new Map(
    (actors ?? []).map((a) => [
      a.id as string,
      { name: a.full_name as string | null, email: a.email as string | null },
    ]),
  );

  const enriched = (events ?? []).map((e) => ({
    ...e,
    actor_name: e.actor_id ? actorMap.get(e.actor_id as string)?.name ?? null : null,
    actor_email: e.actor_id ? actorMap.get(e.actor_id as string)?.email ?? null : null,
  }));

  return <AuditView events={enriched} />;
}
