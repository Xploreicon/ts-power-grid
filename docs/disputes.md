# T&S Power Grid — Dispute Resolution System

## Overview

The dispute resolution system handles complaints from both **neighbors** (via WhatsApp or PWA) and **hosts** (via the Host PWA). Every dispute captures a full context snapshot at creation time, ensuring admins can investigate the exact state of the connection even after conditions change.

---

## Dispute Flow

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   RAISED     │ →  │ INVESTIGATING│ →  │   RESOLVED   │    │   REJECTED   │
│   (open)     │    │              │    │  (+ refund?) │    │              │
└──────────────┘    └──┬───────────┘    └──────────────┘    └──────────────┘
                       │
                       ├→ ESCALATED (to super_admin)
                       │
                       └→ AWAITING_INFO (reporter contacted)
```

### Entry Points

| Source    | How                                   | Category        |
|-----------|---------------------------------------|-----------------|
| WhatsApp  | `REPORT <description>`                | `auto_detect`   |
| Host PWA  | `/host/support` form                  | User selects    |
| Admin     | Can create on behalf of user          | Admin selects   |

---

## SLA Policy

| Metric           | Target           | Enforcement                           |
|------------------|------------------|---------------------------------------|
| Acknowledgement  | < 1 hour         | SLA badge shown on dispute            |
| Resolution       | < 24 hours       | Auto-escalate to super_admin at 24h   |

SLA status is displayed on each dispute detail page:
- **On-time** (green): < 1 hour since creation
- **Warning** (yellow): 1–24 hours since creation
- **Breached** (red): > 24 hours since creation

Auto-escalation runs via `/api/cron/sla` (hourly cron job). It:
1. Finds all open/investigating disputes older than 24 hours
2. Sets status to `escalated`
3. Assigns to a `super_admin`
4. Sends a `high_priority_dispute` notification
5. Adds an auto-escalation note to the dispute timeline

---

## Categorization Guide

| Category       | Description                                         | Typical Resolution               |
|----------------|-----------------------------------------------------|----------------------------------|
| `billing`      | Incorrect charge, double charge, missing top-up     | Refund from treasury             |
| `disconnect`   | Wrongful disconnection, failed reconnection         | Reconnect + possible refund      |
| `meter_fault`  | Meter not reading, wrong readings, hardware issue   | Dispatch technician              |
| `pricing`      | Price too high, unexpected price change              | Price rollback or explanation     |
| `auto_detect`  | WhatsApp reports (admin categorizes during triage)   | Re-categorize first              |
| `other`        | Anything that doesn't fit above                     | Case-by-case                     |

---

## Investigation Playbook

### Step 1: Review Context Snapshot

The context snapshot captures at dispute creation time:
- Connection status (active/suspended)
- Current price per kWh
- Wallet balance
- Last 24h transactions
- Last 24h meter readings
- Gateway online/offline status
- Prior dispute count on same connection

### Step 2: Check Patterns

The detail page shows:
- **Related disputes** on the same connection
- **Prior dispute count** (flagged if > 0)
- This helps identify serial complainers or genuinely problematic connections

### Step 3: Take Action

| Action          | When to Use                                        | What Happens                         |
|-----------------|-----------------------------------------------------|--------------------------------------|
| **Resolve**     | Issue confirmed, reporter is right                  | Optional refund + close + notify     |
| **Reject**      | Issue not valid after investigation                 | Reason recorded + close + notify     |
| **Escalate**    | Needs super_admin (refund > ₦10K, policy decision) | Transfers to super_admin + notify    |
| **Request Info**| Need more details from reporter                    | Status → `awaiting_info` + notify    |

### Step 4: Refund Decision

- **Refunds ≤ ₦10,000**: Any admin can issue
- **Refunds > ₦10,000**: Requires `super_admin`
- **Source options**:
  - `host` — debits the host's wallet (when host is at fault)
  - `treasury` — T&S absorbs the cost (system error, goodwill)
- **Auto-reconnect**: If refund restores a positive balance and meter was disconnected, auto-reconnects

---

## Duplicate Refund Prevention

The system prevents duplicate refunds on the same dispute. If `disputes.refund_amount_kobo > 0`, any subsequent refund attempt is rejected with an error.

---

## Notifications

| Event                  | Who Gets Notified  | Channels        |
|------------------------|--------------------|-----------------|
| Dispute created        | All admins         | In-app + email  |
| Dispute resolved       | Reporter + host    | Push + email    |
| Dispute rejected       | Reporter + host    | Push + email    |
| Dispute escalated      | Super admin        | In-app + email  |
| SLA auto-escalation    | Super admin        | In-app + email  |

---

## Metrics Dashboard

Available at `/admin/disputes/metrics`:

- **Summary cards**: Open, Total, Resolved, Rejected, SLA Breached counts
- **Resolution by Category**: Total, resolved count, resolution rate, avg resolution time
- **Top 10 Problem Hosts**: Hosts with most disputes against their connections
- **Top 10 Problem Reporters**: Users who raise the most disputes

---

## API Endpoints

| Method | Path                        | Description                    |
|--------|-----------------------------|--------------------------------|
| PATCH  | `/api/admin/disputes/[id]`  | Update dispute (status, notes, refund, escalation) |
| GET    | `/api/cron/sla`             | SLA enforcement cron job       |

---

## Database Schema Extensions

The `disputes` table was extended with:
- `context` (jsonb) — Frozen context snapshot
- `assigned_to` (uuid) — Admin handling the case
- `escalated_to` (uuid) — Super admin for escalated cases
- `escalated_at` (timestamptz)
- `sla_acknowledged_at` (timestamptz)
- `photos` (text[]) — Up to 3 photo URLs
- `source` (text) — `pwa` or `whatsapp`
- `refund_amount_kobo` (numeric) — Refund amount if applicable
- `refund_source` (text) — `host` or `treasury`

New table: `dispute_notes` for threaded investigation notes.

New RPC: `process_refund` for atomic refund processing.
