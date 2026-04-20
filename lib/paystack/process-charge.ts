import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { processTopup } from "@/lib/billing/topup";
import type { VerifyTransactionResult } from "./client";

/**
 * Shared idempotent handler for a successful Paystack charge. Called by both:
 *   - /api/payments/verify (user-initiated post-redirect check)
 *   - /api/webhooks/paystack (server-to-server retry-safe delivery)
 *
 * The reference carries the type prefix (topup_, installment_, installation_)
 * so we can route without re-reading metadata. billing.processTopup is itself
 * idempotent via transactions.reference UNIQUE, so double-processing the
 * same reference is safe.
 */
export async function processChargeSuccess(
  supabase: SupabaseClient,
  tx: VerifyTransactionResult,
): Promise<{ handled: boolean; type: string; note?: string }> {
  const type = typeFromReference(tx.reference);
  const metadata = parseMetadata(tx.metadata);
  const userId = metadata?.user_id as string | undefined;

  if (type === "topup") {
    if (!userId) {
      return {
        handled: false,
        type,
        note: "topup without user_id in metadata",
      };
    }
    await processTopup(supabase, {
      userId,
      amountKobo: tx.amount,
      reference: tx.reference,
    });
    if (tx.customer?.customer_code) {
      await supabase
        .from("profiles")
        .update({ paystack_customer_code: tx.customer.customer_code })
        .eq("id", userId);
    }
    return { handled: true, type };
  }

  if (type === "installment") {
    const installmentId = metadata?.installment_id as string | undefined;
    if (!installmentId) {
      return { handled: false, type, note: "missing installment_id" };
    }
    // Only flip pending→paid. Already-paid is a no-op (idempotent).
    const { error } = await supabase
      .from("installments")
      .update({
        status: "paid",
        paid_at: tx.paid_at ?? new Date().toISOString(),
      })
      .eq("id", installmentId)
      .eq("status", "pending");
    if (error) throw error;
    return { handled: true, type };
  }

  if (type === "installation") {
    const siteId = metadata?.site_id as string | undefined;
    if (!siteId) {
      return { handled: false, type, note: "missing site_id" };
    }
    const { error } = await supabase
      .from("sites")
      .update({ status: "scheduled" })
      .eq("id", siteId)
      .in("status", ["pending", "approved"]);
    if (error) throw error;
    return { handled: true, type };
  }

  return { handled: false, type, note: "unknown reference prefix" };
}

function typeFromReference(
  reference: string,
): "topup" | "installment" | "installation" | "unknown" {
  if (reference.startsWith("topup_")) return "topup";
  if (reference.startsWith("installment_")) return "installment";
  if (reference.startsWith("installation_")) return "installation";
  return "unknown";
}

function parseMetadata(
  metadata: VerifyTransactionResult["metadata"],
): Record<string, unknown> | null {
  if (!metadata) return null;
  if (typeof metadata === "string") {
    try {
      return JSON.parse(metadata);
    } catch {
      return null;
    }
  }
  return metadata as Record<string, unknown>;
}
