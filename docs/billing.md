# T&S Power Grid — Billing Engine

The billing engine turns raw meter readings into money movements. It is
the most safety-critical subsystem in the platform: bugs here mean
either neighbours are overcharged or hosts lose earnings. This document
covers the end-to-end flow and the invariants every contributor must
preserve.

## Money representation

- **All monetary values are integer kobo (1 NGN = 100 kobo).**
- Floats are never used for naira. Division by 100 happens only at the
  display layer (`lib/utils/money.ts`).
- `current_price_per_kwh` on `connections` is stored as `numeric(8,2)`
  in raw NGN (e.g. `280.00`). The engine multiplies by 100 at charge
  time and uses `round()` once — downstream math is all integers.

## High-level flow

```
Gateway (MQTT → HTTP) ──POST──► /api/meters/readings
                                      │
                                      ▼
                         processReading()  [lib/billing/engine.ts]
                                      │
                                      │ supabase.rpc('process_meter_reading', …)
                                      ▼
            ┌──────────── Atomic PL/pgSQL transaction ────────────┐
            │  SELECT … FOR UPDATE (meter, wallets)              │
            │  idempotency check on transaction.reference        │
            │  compute delta, amount, fee, host_earn (all kobo)  │
            │  UPDATE wallets  (debit + credit)                  │
            │  INSERT transactions × (1 + optional host + fee)   │
            │  UPDATE meters.last_reading_kwh                    │
            │  INSERT telemetry                                  │
            │  INSERT billing_audit  (event=reading_charged)     │
            │  RETURN jsonb {status, action, amounts, balance}   │
            └─────────────────────────────────────────────────────┘
                                      │
                                      ▼
           dispatch side-effects based on `action`:
             - disconnect   → issueDisconnectCommand()
             - low_balance  → notifications insert
             - none         → done
```

## Idempotency

Every reading has a deterministic reference:

```
reading:<meter_id>:<cumulative_kwh>
```

That string is stored as `transactions.reference` on the neighbour's
consumption row. Because `transactions.reference` is UNIQUE, a duplicate
reading (same meter, same cumulative) surfaces a fast `duplicate` status
and does zero writes. This is robust to:

- Gateway retries on flaky connectivity.
- Double-submission from upstream queues.
- API timeouts that the gateway interprets as failure.

Top-ups are idempotent on the Paystack reference. Withdrawals are
idempotent on `(transaction_id, status)` — `complete_withdrawal` and
`fail_withdrawal` no-op if the terminal state has already been reached.

## Anomaly handling

The engine protects wallets from meter faults and malformed payloads:

| Delta condition | Behaviour |
|---|---|
| `delta < 0` | `reading_anomaly_negative`, no billing, no meter pointer change (keeps next valid reading meaningful). |
| `delta > MAX_REASONABLE_READING_DELTA_KWH` (100) | `reading_anomaly_excessive`, same treatment. |
| `delta = 0` | `flat_reading`, telemetry only. |
| `amount_kobo = 0` after rounding | `flat_reading`, no transaction rows. |

Every anomaly is appended to `billing_audit` with the full payload so
operations can inspect patterns.

## Low-balance / disconnect signalling

After a successful charge the engine compares the new balance against
`LOW_BALANCE_THRESHOLD_KOBO` (₦200) and decides an `action`:

- `disconnect` — the charge fully drained the wallet, or the wallet had
  insufficient funds and only a partial debit occurred. The TS layer
  calls `issueDisconnectCommand()` which (a) marks
  `meters.status = 'disconnected'`, (b) writes an audit row, and
  (c) — once Prompt 15 lands — publishes an MQTT command to the
  gateway. Re-running a disconnect is harmless.
- `low_balance` — not yet drained, but under threshold. The TS layer
  inserts a `notifications` row which drives both the in-app feed and
  any push transport.

## Partial charging when balance is insufficient

`wallets.balance` has a `>= 0` check constraint. Rather than aborting
the charge, the engine debits `least(amount, balance)`; recomputes fee
and host earnings pro-rata on the charged amount; writes transactions
with `metadata.insufficient_funds = true`; and sets
`action = 'disconnect'`. The reading itself is still considered
`processed` (or `insufficient_funds` status for clarity) — hosts get
their partial earnings, neighbours are disconnected, and the delta is
acknowledged so the next reading can produce a sensible delta once the
wallet is topped up.

## Withdrawals (hold-based)

The older `initiate_withdrawal` SQL function debited immediately — but a
failed Paystack transfer then needed a compensating refund, doubling
the surface area for bugs. The new flow separates hold from debit:

| Function | Wallet effect | Transaction.status |
|---|---|---|
| `request_withdrawal` | none (validates `balance − Σ pending`) | `pending` |
| `complete_withdrawal` | debits the wallet | `success` |
| `fail_withdrawal` | none | `failed` |

A withdrawal that never completes simply leaves the `pending` row (and
corresponding hold) in place; admins can fail it explicitly. Available
balance everywhere should be `wallet.balance − sum(pending withdrawals)`.

## Audit trail

`billing_audit` is append-only. Every engine event — received reading,
duplicate, anomaly, charge, low-balance notify, disconnect, reconnect,
topup, withdrawal request/complete/fail — lands there with a typed
`event_type` and a `details` jsonb payload. RLS grants SELECT only to
admins; only the service role can INSERT. **Never** mutate or delete
rows; correct errors by emitting a compensating event.

## Configuration

Tunables live in `lib/billing/config.ts` and are passed to every RPC as
explicit parameters:

| Key | Value | Effect |
|---|---|---|
| `PLATFORM_FEE_PERCENT` | `0.05` | 5% of gross charge routed to platform. |
| `LOW_BALANCE_THRESHOLD_KOBO` | `20_000` | ₦200 — notify below this. |
| `MAX_REASONABLE_READING_DELTA_KWH` | `100` | Flag anomalies above. |
| `MIN_WITHDRAWAL_KOBO` | `500_000` | ₦5,000 minimum per withdrawal. |

Changes here take effect at deploy time without a DB migration.

## Gateway auth

`POST /api/meters/readings` requires header `x-gateway-api-key`. The
route sha256-hashes the key and compares against
`gateways.api_key_hash` (migration 0013). The meter must belong to the
gateway whose key was presented — prevents a compromised gateway from
reporting on another's meters.

## Tech debt / followups

- **Treasury wallet**: platform fee is currently booked as a
  `platform_fee` transaction on the host wallet with metadata noting
  the accounting-only role. A dedicated platform-treasury wallet
  (`wallets.is_platform_treasury`, seeded once) will let us reconcile
  independently. Until then, platform-fee aggregates should be computed
  from `transactions WHERE type='platform_fee'` — not from wallet
  balances.
- **MQTT publish**: `issueDisconnectCommand` / `issueReconnectCommand`
  log + update status only. Prompt 15 wires the actual MQTT client.
- **Paystack verification**: `verifyPaystackReference` is stubbed;
  Prompt 10 replaces it with a signed webhook + `/transaction/verify`
  call.
- **Partition maintenance**: `telemetry` partitions are created
  eagerly at migration time; schedule a `pg_cron` job to create the
  next-day partition daily.
