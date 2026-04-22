import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AdminRole = "admin" | "super_admin";

export interface AdminSession {
  userId: string;
  email: string | null;
  fullName: string | null;
  role: AdminRole;
}

/**
 * Server-side guard for /admin/* pages. Redirects to /admin/sign-in if the
 * visitor isn't signed in or isn't admin/super_admin. Returns the session
 * when allowed.
 *
 * Middleware already blocks anonymous hits at the edge; this is a belt-and-
 * braces check so page handlers can also trust the role and show
 * role-scoped UI (super_admin-only buttons etc).
 */
export async function requireAdmin(): Promise<AdminSession> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, email, full_name")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role as string | undefined;
  if (role !== "admin" && role !== "super_admin") {
    redirect("/");
  }

  return {
    userId: user.id,
    email: (profile?.email as string | null) ?? user.email ?? null,
    fullName: (profile?.full_name as string | null) ?? null,
    role: role as AdminRole,
  };
}

/**
 * Gated actions only super_admin can perform:
 *   - withdrawal approvals above ₦500,000
 *   - manual wallet adjustments
 *   - issuing refunds
 */
export const SUPER_ADMIN_ACTIONS = [
  "withdrawal.approve.large",
  "wallet.adjust",
  "transaction.refund",
] as const;

export type SuperAdminAction = (typeof SUPER_ADMIN_ACTIONS)[number];

export function canPerform(
  role: AdminRole,
  action: SuperAdminAction,
): boolean {
  void action;
  return role === "super_admin";
}

export const LARGE_WITHDRAWAL_KOBO = 50_000_000; // ₦500,000
