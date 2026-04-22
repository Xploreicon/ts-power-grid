import { createAdminClient } from "@/lib/supabase/admin";
import { CustomersTable } from "./customers-table";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const supabase = createAdminClient();
  const [{ data: profiles }, { data: wallets }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, phone, email, role, kyc_status, created_at")
      .in("role", ["host", "neighbor"])
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("wallets").select("user_id, balance"),
  ]);

  const balanceByUser = new Map<string, number>();
  for (const w of wallets ?? []) {
    balanceByUser.set(w.user_id as string, Number(w.balance ?? 0));
  }

  const rows: CustomerRow[] = (profiles ?? []).map((p) => ({
    id: p.id as string,
    full_name: (p.full_name as string | null) ?? null,
    phone: (p.phone as string | null) ?? null,
    email: (p.email as string | null) ?? null,
    role: p.role as "host" | "neighbor",
    kyc_status: (p.kyc_status as string | null) ?? null,
    created_at: p.created_at as string,
    wallet_balance_kobo: balanceByUser.get(p.id as string) ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Customers</h1>
        <p className="text-sm text-navy-700/70">
          Unified view of every host and neighbor.
        </p>
      </div>
      <CustomersTable rows={rows} />
    </div>
  );
}

export interface CustomerRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: "host" | "neighbor";
  kyc_status: string | null;
  created_at: string;
  wallet_balance_kobo: number;
}
