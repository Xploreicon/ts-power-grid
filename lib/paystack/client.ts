import "server-only";

/**
 * Thin, typed wrapper around the Paystack REST API.
 *
 * Principles:
 *  - Secret key read from env at call time (not at import) so missing-env
 *    errors surface at request time, not build time.
 *  - Never logs the secret. Error objects carry status + Paystack message.
 *  - All amounts are in KOBO (integers). Callers convert if they hold naira.
 *  - No retry logic here — callers (webhooks, background jobs) decide.
 */

const PAYSTACK_BASE = "https://api.paystack.co";

export class PaystackError extends Error {
  status: number;
  paystackMessage: string;
  constructor(status: number, paystackMessage: string) {
    super(`Paystack ${status}: ${paystackMessage}`);
    this.name = "PaystackError";
    this.status = status;
    this.paystackMessage = paystackMessage;
  }
}

export class PaystackConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaystackConfigError";
  }
}

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new PaystackConfigError("PAYSTACK_SECRET_KEY is not configured");
  }
  return key;
}

async function request<T>(
  path: string,
  init: RequestInit & { searchParams?: Record<string, string | undefined> } = {},
): Promise<T> {
  const { searchParams, ...rest } = init;
  let url = `${PAYSTACK_BASE}${path}`;
  if (searchParams) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v !== undefined) qs.set(k, v);
    }
    const s = qs.toString();
    if (s) url += `?${s}`;
  }

  const res = await fetch(url, {
    ...rest,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
      ...(rest.headers ?? {}),
    },
    // Paystack endpoints we call are small; default Next caching off.
    cache: "no-store",
  });

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new PaystackError(res.status, "Invalid JSON from Paystack");
  }

  const payload = body as {
    status?: boolean;
    message?: string;
    data?: unknown;
  };

  if (!res.ok || payload.status === false) {
    throw new PaystackError(
      res.status,
      payload.message ?? `Request to ${path} failed`,
    );
  }

  return payload.data as T;
}

// ---------------------------------------------------------------------------
// Types — only fields we actually use. Paystack returns more.
// ---------------------------------------------------------------------------

export type InitializeTransactionInput = {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
  channels?: Array<"card" | "bank" | "ussd" | "bank_transfer" | "qr" | "mobile_money">;
};

export type InitializeTransactionResult = {
  authorization_url: string;
  access_code: string;
  reference: string;
};

export type VerifyTransactionResult = {
  id: number;
  status: "success" | "failed" | "abandoned" | string;
  reference: string;
  amount: number; // kobo
  gateway_response: string;
  paid_at: string | null;
  currency: string;
  customer: {
    id: number;
    email: string;
    customer_code: string;
  };
  metadata: Record<string, unknown> | string | null;
  fees: number | null;
};

export type Bank = {
  name: string;
  slug: string;
  code: string;
  longcode: string;
  active: boolean;
  country: string;
  currency: string;
  type: string;
};

export type ResolveAccountResult = {
  account_number: string;
  account_name: string;
  bank_id: number;
};

export type CreateRecipientInput = {
  name: string;
  accountNumber: string;
  bankCode: string;
  currency?: "NGN";
};

export type CreateRecipientResult = {
  id: number;
  recipient_code: string;
  name: string;
  details: {
    account_number: string;
    account_name: string;
    bank_code: string;
    bank_name: string;
  };
};

export type InitiateTransferInput = {
  recipientCode: string;
  amountKobo: number;
  reason: string;
  reference: string;
};

export type InitiateTransferResult = {
  id: number;
  reference: string;
  transfer_code: string;
  status: string;
  amount: number;
  recipient: number | { recipient_code: string };
};

// ---------------------------------------------------------------------------
// Methods
// ---------------------------------------------------------------------------

export async function initializeTransaction(
  input: InitializeTransactionInput,
): Promise<InitializeTransactionResult> {
  return request<InitializeTransactionResult>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: input.amountKobo,
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
      channels: input.channels,
    }),
  });
}

export async function verifyTransaction(
  reference: string,
): Promise<VerifyTransactionResult> {
  return request<VerifyTransactionResult>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
    { method: "GET" },
  );
}

export async function listBanks(
  opts: { country?: string; currency?: string } = {},
): Promise<Bank[]> {
  return request<Bank[]>("/bank", {
    method: "GET",
    searchParams: {
      country: opts.country ?? "nigeria",
      currency: opts.currency ?? "NGN",
      perPage: "100",
    },
  });
}

export async function resolveAccount(
  accountNumber: string,
  bankCode: string,
): Promise<ResolveAccountResult> {
  return request<ResolveAccountResult>("/bank/resolve", {
    method: "GET",
    searchParams: {
      account_number: accountNumber,
      bank_code: bankCode,
    },
  });
}

export async function createTransferRecipient(
  input: CreateRecipientInput,
): Promise<CreateRecipientResult> {
  return request<CreateRecipientResult>("/transferrecipient", {
    method: "POST",
    body: JSON.stringify({
      type: "nuban",
      name: input.name,
      account_number: input.accountNumber,
      bank_code: input.bankCode,
      currency: input.currency ?? "NGN",
    }),
  });
}

export async function initiateTransfer(
  input: InitiateTransferInput,
): Promise<InitiateTransferResult> {
  return request<InitiateTransferResult>("/transfer", {
    method: "POST",
    body: JSON.stringify({
      source: "balance",
      recipient: input.recipientCode,
      amount: input.amountKobo,
      reason: input.reason,
      reference: input.reference,
    }),
  });
}
