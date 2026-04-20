# Payments — Paystack Integration

All monetary amounts in this system are **integer kobo**. `₦1 = 100 kobo`.

## Scope

| Flow | Who pays | Who receives | Route |
|---|---|---|---|
| Wallet top-up | Neighbor | T&S (credited to wallet) | `/api/payments/initialize` → Paystack Checkout → `/payments/callback` |
| Host withdrawal | T&S balance | Host bank account | `/api/payments/withdraw` → Paystack Transfer |
| Installment | Host | T&S (financing instalments) | `/api/payments/initialize` type `installment` |
| Installation upfront | Host | T&S (Path A first / Path B full) | `/api/payments/initialize` type `installation` |

## Flow: Top-up

```
Neighbor PWA               Next.js API              Paystack              DB
      │                        │                       │                   │
      │  click "Top up"        │                       │                   │
      ├──────────────────────▶ │                       │                   │
      │                        │  insert transactions  │                   │
      │                        │  (pending, ref=..)   ─┼─▶                 │
      │                        │  POST /initialize     │                   │
      │                        ├──────────────────────▶│                   │
      │                        │  authorization_url   ◀│                   │
      │  302 redirect         ◀│                       │                   │
      │                        │                       │                   │
      │  (Paystack checkout)   │                       │                   │
      │──────────────────────▶ Paystack                │                   │
      │  redirect back to /payments/callback?reference=..                  │
      │                        │                       │                   │
      │  POST /verify          │                       │                   │
      ├──────────────────────▶ │  GET /transaction/verify                  │
      │                        ├──────────────────────▶│                   │
      │                        │  { status: success } ◀│                   │
      │                        │  rpc process_topup    │                   │
      │                        ├──────────────────────────────────────────▶│
      │                        │  (idempotent on reference)                │
      │  200 OK               ◀│                       │                   │
      │                        │                       │                   │
      │  (webhook retry path) POST /webhooks/paystack  │                   │
      │                        │◀──────────────────────│                   │
      │                        │  verify signature                         │
      │                        │  rpc process_topup (no-op if already paid)│
```

Both `/verify` and `/webhooks/paystack` call `processChargeSuccess`, which
calls `billing.processTopup` — idempotent via `transactions.reference UNIQUE`.
Running them both on the same reference is safe.

## Flow: Host withdrawal

Funds are **held, not debited**, at the moment the host submits. Debit
happens only when Paystack's `transfer.success` webhook lands. On failure,
the hold is released — no compensating refund needed.

```
initiate_withdrawal (DB)  →  creates pending transactions row
   │
   ▼
Paystack /transfer          →  Paystack acknowledges
   │
   ▼  (async, can take minutes)
webhook transfer.success   →  complete_withdrawal (debit + mark success)
     or
webhook transfer.failed    →  fail_withdrawal (no balance change)
```

A Paystack transfer recipient (`RCP_xxx`) is created on first withdrawal and
cached on `profiles.paystack_recipient_code`.

## Idempotency

| Mechanism | Where |
|---|---|
| `transactions.reference` UNIQUE | Postgres; `process_topup`/`process_meter_reading` short-circuit on duplicate |
| Withdrawal hold (no debit on initiate) | `request_withdrawal` SQL fn |
| Webhook log | `paystack_webhook_events` — every delivery recorded regardless of processing |
| Re-verify on webhook | `charge.success` re-calls `verifyTransaction` before processing |

## Signature verification

Webhooks must carry `x-paystack-signature`. We verify via HMAC-SHA512 over
the raw body with `PAYSTACK_WEBHOOK_SECRET` (falls back to
`PAYSTACK_SECRET_KEY` if unset — Paystack uses the same key for both by
default). `lib/paystack/signature.ts` uses `crypto.timingSafeEqual`.

Invalid signatures return HTTP 200 (logged, not processed) so Paystack does
not retry forever.

## Rate limits (in-memory, per instance)

| Endpoint | Limit |
|---|---|
| `/api/payments/initialize` | 30/min/IP |
| `/api/payments/verify` | 10/min/IP |
| `/api/payments/withdraw` | 5/min/IP |
| `/api/paystack/resolve-account` | 20/min/IP |

In-memory is intentional — keeps the dependency footprint small. Swap for
`@upstash/ratelimit` in production if abuse becomes an issue.

## Environment variables

```bash
PAYSTACK_SECRET_KEY=sk_test_...          # Secret key (never client)
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_ # Public key (client-safe; currently unused — redirect flow)
PAYSTACK_WEBHOOK_SECRET=sk_test_...      # Defaults to PAYSTACK_SECRET_KEY if unset
PAYSTACK_CALLBACK_URL=https://ts-power-grid.vercel.app/payments/callback
NEXT_PUBLIC_APP_URL=https://ts-power-grid.vercel.app
```

Configure the webhook endpoint in Paystack Dashboard → Settings → API Keys &
Webhooks:
- **URL**: `https://<your-host>/api/webhooks/paystack`
- **Events**: `charge.success`, `transfer.success`, `transfer.failed`,
  `transfer.reversed`

## Testing (Paystack Test Mode)

| Card | Result |
|---|---|
| `4084 0840 8408 4081` | Success |
| `4000 0000 0000 0119` | Failed |
| `5060 6666 6666 6666 666` | PIN + OTP, success |

Expiry: any future date. CVV: any 3 digits. PIN: `1234`. OTP: `123456`.

### End-to-end test recipe

1. Seed a neighbor account + wallet.
2. `POST /api/payments/initialize` with `{ type: "topup", amount_kobo: 50000 }`.
3. Visit the returned `authorization_url`, pay with the success card.
4. Paystack redirects to `/payments/callback?reference=topup_...` —
   `POST /api/payments/verify` runs, wallet credited.
5. Trigger a redelivery from the Paystack dashboard — webhook runs,
   `paystack_webhook_events` gets a row with `signature_valid=true`,
   `processed_at` set, no double-credit.

## Tech debt

- **Treasury wallet**: platform fees and host earnings currently write to
  host wallets only. Needs a dedicated treasury wallet row + redirection of
  platform-fee legs in `process_meter_reading`.
- **Bank code persistence**: `profiles.bank_name` currently stores the
  display name. Withdrawals need `bank_code` — the onboarding bank step
  should store both (e.g. "Bank Name|058") or add a `bank_code` column.
- **Upstash rate-limit**: swap `lib/paystack/rate-limit.ts` for a Redis-backed
  limiter when traffic warrants.
- **Installment auto-generation**: `installations` payment success should
  generate the installment schedule (Path A) rather than relying on a
  separate admin action.
