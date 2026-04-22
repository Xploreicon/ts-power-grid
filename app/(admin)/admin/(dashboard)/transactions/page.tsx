import { createAdminClient } from "@/lib/supabase/admin";
import { TransactionsTable } from "./transactions-table";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("transactions")
    .select(
      "id, type, amount, status, reference, created_at, wallet_id, wallets:wallet_id(user_id, profiles:user_id(full_name, phone))",
    )
    .order("created_at", { ascending: false })
    .limit(1000);

  const rows: TransactionRow[] = (data ?? []).map((t) => {
    const wallet = (t.wallets as unknown) as
      | {
          user_id: string | null;
          profiles: { full_name: string | null; phone: string | null } | null;
        }
      | null;
    return {
      id: t.id as string,
      type: t.type as string,
      amount_kobo: Number(t.amount ?? 0),
      status: t.status as string,
      reference: (t.reference as string | null) ?? null,
      created_at: t.created_at as string,
      user_name: wallet?.profiles?.full_name ?? null,
      user_phone: wallet?.profiles?.phone ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Transactions</h1>
        <p className="text-sm text-navy-700/70">
          Ledger-level record of every money movement.
        </p>
      </div>
      <TransactionsTable rows={rows} />
    </div>
  );
}

export interface TransactionRow {
  id: string;
  type: string;
  amount_kobo: number;
  status: string;
  reference: string | null;
  created_at: string;
  user_name: string | null;
  user_phone: string | null;
}
