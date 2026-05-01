# Notifications

Two layers of "messages to users" that often get conflated, kept
separate here:

| Layer | Drives | Module |
|---|---|---|
| **Conversational** | Neighbor-facing messages (welcome, low balance, disconnect, top-up confirmation, daily summary). User-initiated commands (BAL / TOP / USAGE / …). One channel per deployment. | `lib/messaging` → `lib/whatsapp/*` or `lib/telegram/*` |
| **Eventing** | Push, email, SMS, in-app alerts driven by domain events (dispute raised, withdrawal approved, gateway offline). Multi-channel per event. | `lib/notifications/dispatcher` → `lib/notifications/channels/*` |

Don't merge them. Conversational messaging is two-way and bound to a
specific channel per gateway. Eventing fans out a single payload
across whatever channels the user has opted into. The two layers
share a recipient table (`profiles`) but nothing else.

## Channel switch

`MESSAGING_CHANNEL=telegram|whatsapp` (default `whatsapp`). The
`lib/messaging/index.ts` module reads this once at module load and
re-exports the active channel's send-functions:

```ts
import { sendWelcomeMessage, sendDisconnectNotification } from "@/lib/messaging";
```

Callers — `lib/billing/engine.ts`, `lib/billing/topup.ts`,
`app/api/cron/daily-summary/route.ts`, the host-add-neighbor route —
import from `@/lib/messaging`, never from `@/lib/whatsapp/proactive`
or `@/lib/telegram/proactive`. That keeps the channel switch
single-source-of-truth.

To run a side-by-side migration (some sites on Telegram, some on
WhatsApp) you'd need a per-host channel column on `sites` and a
runtime switch. Out of scope for now — Lagos pilot is single-channel.

## WhatsApp

Provider: WhatsApp Business Cloud API (Meta, Graph v20.0).

```
neighbor ──▶ Meta ──▶ POST /api/webhooks/whatsapp
                       │
                       ├── verify HMAC-SHA256 (x-hub-signature-256)
                       ├── insert inbound row in whatsapp_messages
                       └── routeMessage() → command handler → reply
                                                        │
neighbor ◀── Meta ◀──   sendMessage() / sendTemplate()  ┘
```

Rules baked into `lib/whatsapp`:

- Free-form text replies (`sendMessage`) are valid only inside the
  24-hour service window. Outside that window you must use a
  pre-approved template (`sendTemplate`); proactive senders pass
  both.
- Inbound message id (`wa_message_id`) is the dedup key. The webhook
  is at-least-once; we drop duplicates on insert.
- 20 messages/min per sender via `lib/paystack/rate-limit`.

## Telegram

Provider: Telegram Bot API via `telegraf`.

```
neighbor ──▶ Telegram ──▶ POST /api/telegram/webhook
                            │  (verify X-Telegram-Bot-Api-Secret-Token)
                            ▼
                       handleUpdate(update)
                            │
                            ├── /start → request contact
                            ├── contact share → bind chat_id ↔ phone
                            └── text/command → routeTelegramMessage()
                                                    │
                                                    ▼
                                  shared command handlers (lib/whatsapp/commands/*)
                                                    │
neighbor ◀── Telegram ◀── ctx.reply(...) ◀──────────┘
```

Binding is one-time:

1. Host adds a neighbor; the welcome message is delivered as SMS
   (Telegram fallback) and includes `https://t.me/<bot_username>`.
2. Neighbor opens the link, taps **Start**.
3. Bot replies with a request-contact button. Tapping it ships the
   user's stored phone to the bot.
4. We verify `contact.user_id == ctx.from.id` (Telegram lets users
   share *anyone's* contact card otherwise — guard against drive-by
   binding) and call `bind_telegram_chat(phone, chat_id)`.
5. From here on, every chat_id resolves to a phone, which loads the
   same `NeighborContext` the WhatsApp router uses.

Re-binding is supported: a unique partial index on `telegram_chat_id`
clears any stale binding for that chat before the new one is written.
A user moving phones starts the bot from the new device, shares
contact, and the old binding is replaced.

### Commands

Same surface as WhatsApp, slash-prefixed:

| Command | Effect |
|---|---|
| `/start` | Onboarding (binding) |
| `/bal` | Wallet balance + today's consumption |
| `/top 500` | Generate Paystack top-up link for ₦500 |
| `/usage` | Today + last 7 days |
| `/price` | Current per-kWh rate from active host |
| `/help` | List of commands |
| `/report <issue>` | Open a dispute against the active connection |

`STOP`/`START`/`HISTORY` remain WhatsApp-only — Telegram's
notification toggle is the platform-level mute, and we don't
duplicate it.

### Webhook setup

Once per environment:

```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=https://app.tspowergrid.com/api/telegram/webhook" \
  -d "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
  -d 'allowed_updates=["message","callback_query"]'
```

Or programmatically via `setWebhook(url, secretToken)` from
`lib/telegram/client.ts`.

### Schema

`supabase/migrations/20260430000001_telegram_binding.sql`:

```sql
alter table public.profiles add column telegram_chat_id bigint;
create unique index profiles_telegram_chat_id_key
    on public.profiles (telegram_chat_id) where telegram_chat_id is not null;

create function public.bind_telegram_chat(p_phone text, p_chat_id bigint)
    returns uuid security definer ...
create function public.resolve_telegram_chat(p_chat_id bigint)
    returns text security definer ...
```

Both RPCs are service-role only; the webhook handler is the only
caller.

### Logs

Outbound Telegram messages land in `whatsapp_messages` (yes, the
table name is legacy — it's our generic messaging ledger now) with
`provider = 'telegram_bot'`. SMS fallbacks land with
`provider = 'termii_sms'`. Status callbacks aren't supported by the
Bot API, so the row's status is always `sent`/`failed`/`fell_back_to_sms`
at write time.

## Eventing dispatcher

Unchanged on this commit. `lib/notifications/dispatcher.ts` still
fans out across push / email / SMS / in-app / whatsapp based on
event type and per-user preferences. The `whatsapp` channel inside
the dispatcher continues to call `sendTemplate` directly — it's used
for templated notifications (template id + variables) which Telegram
doesn't have an analogue for. If we later want Telegram-backed
eventing we'd add a parallel `channels/telegram.ts`; not needed yet.

## Testing locally

WhatsApp:

```bash
curl -X POST http://localhost:3000/api/webhooks/whatsapp \
  -H 'content-type: application/json' \
  -d '{ "entry": [{ "changes": [{ "value": {
    "messages": [{
      "id": "wamid.test1", "from": "2348012345678",
      "type": "text", "text": { "body": "BAL" }
    }]
  }}]}] }'
```

Telegram (skip the secret in dev — set `TELEGRAM_WEBHOOK_SECRET=` empty):

```bash
curl -X POST http://localhost:3000/api/telegram/webhook \
  -H 'content-type: application/json' \
  -d '{ "update_id": 1, "message": {
        "message_id": 1, "date": 1714492800,
        "chat": { "id": 12345, "type": "private" },
        "from": { "id": 12345, "is_bot": false, "first_name": "Dev" },
        "text": "/bal"
  }}'
```

The dev path won't have a bound chat so `/bal` will request a contact
share. To skip binding for tests, insert a profile row with
`telegram_chat_id = 12345` first.
