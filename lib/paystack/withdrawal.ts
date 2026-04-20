import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createTransferRecipient,
  initiateTransfer,
  resolveAccount,
} from "./client";
import {
  completeWithdrawal,
  failWithdrawal,
  initiateWithdrawal,
} from "@/lib/billing/withdraw";

/**
 * Ensure the host has a Paystack recipient_code on file. If not, resolve the
 * account (server-side sanity check) then create the recipient and persist.
 *
 * Called by the withdrawal flow and whenever the host updates bank details.
 */
export async function ensureRecipientForHost(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ recipientCode: string; accountName: string }> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, bank_name, bank_account_number, bank_account_name, paystack_recipient_code",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!profile) throw new Error("Profile not found");

  if (profile.paystack_recipient_code) {
    return {
      recipientCode: profile.paystack_recipient_code,
      accountName: profile.bank_account_name ?? profile.full_name ?? "",
    };
  }

  if (
    !profile.bank_account_number ||
    !profile.bank_name ||
    !profile.bank_account_name
  ) {
    throw new Error("Bank details missing — complete onboarding first.");
  }

  // profiles.bank_name currently stores the display name; the bank_code
  // required by Paystack is resolved via listBanks. We let the caller
  // do resolution up front during onboarding and store the code. Fallback:
  // reject and ask onboarding to re-run with Paystack resolution.
  const bankCode = extractBankCode(profile.bank_name);
  if (!bankCode) {
    throw new Error(
      "Bank details not yet validated against Paystack. Re-save bank details to enable withdrawals.",
    );
  }

  // Server-side re-resolve before creating recipient (protects against
  // client tampering).
  const resolved = await resolveAccount(
    profile.bank_account_number,
    bankCode,
  );

  const recipient = await createTransferRecipient({
    name: resolved.account_name,
    accountNumber: profile.bank_account_number,
    bankCode,
  });

  await supabase
    .from("profiles")
    .update({
      paystack_recipient_code: recipient.recipient_code,
      bank_account_name: resolved.account_name,
    })
    .eq("id", userId);

  return {
    recipientCode: recipient.recipient_code,
    accountName: resolved.account_name,
  };
}

/**
 * End-to-end withdrawal:
 *   1. Reserve funds via billing.initiateWithdrawal (creates pending txn).
 *   2. Ensure Paystack recipient.
 *   3. Initiate transfer. Paystack then sends transfer.success or
 *      transfer.failed webhooks which finalise via complete/failWithdrawal.
 *
 * On Paystack initiate failure we fail the withdrawal immediately so the
 * held balance is released.
 */
export async function processWithdrawal(
  supabase: SupabaseClient,
  input: { userId: string; amountKobo: number },
): Promise<{ withdrawalId: string; transferReference: string }> {
  const { withdrawalId } = await initiateWithdrawal(supabase, input);

  try {
    const { recipientCode } = await ensureRecipientForHost(
      supabase,
      input.userId,
    );

    const transferReference = `wd_${withdrawalId}`;
    await initiateTransfer({
      recipientCode,
      amountKobo: input.amountKobo,
      reason: "T&S Power Grid host payout",
      reference: transferReference,
    });

    return { withdrawalId, transferReference };
  } catch (err) {
    const reason =
      err instanceof Error ? err.message : "Paystack initiate failed";
    await failWithdrawal(supabase, {
      withdrawalId,
      reason: reason.slice(0, 500),
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Webhook handlers — invoked from /api/webhooks/paystack.
// ---------------------------------------------------------------------------

export async function handleTransferSuccess(
  supabase: SupabaseClient,
  payload: { reference: string; transfer_code?: string },
): Promise<void> {
  const withdrawalId = withdrawalIdFromRef(payload.reference);
  if (!withdrawalId) return;
  await completeWithdrawal(supabase, {
    withdrawalId,
    paystackTransferReference: payload.transfer_code ?? payload.reference,
  });
}

export async function handleTransferFailed(
  supabase: SupabaseClient,
  payload: { reference: string; reason?: string },
): Promise<void> {
  const withdrawalId = withdrawalIdFromRef(payload.reference);
  if (!withdrawalId) return;
  await failWithdrawal(supabase, {
    withdrawalId,
    reason: (payload.reason ?? "Paystack transfer failed").slice(0, 500),
  });
}

function withdrawalIdFromRef(reference: string): string | null {
  // References we generate: `wd_<uuid>`. Everything else is not ours.
  const m = /^wd_([0-9a-f-]{36})$/i.exec(reference);
  return m ? m[1] : null;
}

/**
 * Pull a bank_code suffix out of profiles.bank_name. During onboarding we
 * store "Bank Name|BANKCODE" after Paystack resolution. Accept both.
 */
function extractBankCode(bankName: string | null): string | null {
  if (!bankName) return null;
  const pipe = bankName.indexOf("|");
  if (pipe !== -1) return bankName.slice(pipe + 1).trim();
  // Pure numeric fallback.
  if (/^\d{3,6}$/.test(bankName.trim())) return bankName.trim();
  return null;
}
