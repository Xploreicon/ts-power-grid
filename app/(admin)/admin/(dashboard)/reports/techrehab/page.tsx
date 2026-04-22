import { createAdminClient } from "@/lib/supabase/admin";
import { TechrehabReport } from "./techrehab-report";

export const dynamic = "force-dynamic";

export default async function TechrehabPage() {
  const supabase = createAdminClient();

  // Capital deployed = sum of installation contract amounts.
  const { data: installations } = await supabase
    .from("installations")
    .select("amount, created_at, stage");

  // Capital recovered = sum of paid installments.
  const { data: paidInstallments } = await supabase
    .from("installments")
    .select("amount, paid_at")
    .eq("status", "paid")
    .not("paid_at", "is", null);

  // At-risk = overdue installments amount.
  const { data: overdueInstallments } = await supabase
    .from("installments")
    .select("amount")
    .eq("status", "overdue");

  const capitalDeployedKobo = (installations ?? []).reduce(
    (s, i) => s + Math.abs(Number(i.amount ?? 0)),
    0,
  );
  const capitalRecoveredKobo = (paidInstallments ?? []).reduce(
    (s, i) => s + Math.abs(Number(i.amount ?? 0)),
    0,
  );
  const atRiskKobo = (overdueInstallments ?? []).reduce(
    (s, i) => s + Math.abs(Number(i.amount ?? 0)),
    0,
  );

  // Monthly deployment/recovery buckets (last 12 months).
  const byMonth = new Map<string, { deployed: number; recovered: number }>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toISOString().slice(0, 7);
    byMonth.set(key, { deployed: 0, recovered: 0 });
  }
  for (const inst of installations ?? []) {
    const key = String(inst.created_at).slice(0, 7);
    const slot = byMonth.get(key);
    if (slot) slot.deployed += Math.abs(Number(inst.amount ?? 0));
  }
  for (const p of paidInstallments ?? []) {
    const key = String(p.paid_at).slice(0, 7);
    const slot = byMonth.get(key);
    if (slot) slot.recovered += Math.abs(Number(p.amount ?? 0));
  }

  const monthly = Array.from(byMonth.entries()).map(([m, v]) => ({
    month: m,
    ...v,
  }));

  return (
    <TechrehabReport
      capitalDeployedKobo={capitalDeployedKobo}
      capitalRecoveredKobo={capitalRecoveredKobo}
      atRiskKobo={atRiskKobo}
      monthly={monthly}
    />
  );
}
