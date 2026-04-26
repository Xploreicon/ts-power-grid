# mqtt-ingest

Standalone Node service that subscribes to every `ts/…` topic on the
MQTT broker and persists the results to Supabase. It is the only
consumer of raw gateway telemetry — the Next.js app never reads from
MQTT directly.

## Pipeline

| Topic pattern | Handler | Effect |
|---|---|---|
| `ts/sites/+/meters/+/telemetry` | `handleTelemetry` | `processReading()` — charges, disconnects, audit |
| `ts/sites/+/gateway/heartbeat` | `handleHeartbeat` | `UPDATE gateways SET last_seen_at, status='online'` |
| `ts/sites/+/events` | `handleEvent` | `INSERT gateway_events` + fault-class notifications |

Unparseable topics and invalid JSON payloads are appended to a
JSONL dead-letter file (`DLQ_PATH`, default
`services/mqtt-ingest/dlq.jsonl`).

## Run

Imports (`@/lib/billing/engine`, `@/lib/notifications/dispatcher`)
resolve via the repo-root `tsconfig.json` path aliases, so run from
the repo root:

```bash
# help
pnpm tsx --tsconfig services/mqtt-ingest/tsconfig.json services/mqtt-ingest/index.ts --help

# dry-run — connect + log, no Supabase writes
pnpm tsx --tsconfig services/mqtt-ingest/tsconfig.json services/mqtt-ingest/index.ts --dry-run

# full run
export MQTT_BROKER_URL=mqtt://localhost:1883
export SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL"
export SUPABASE_SERVICE_ROLE_KEY=...
pnpm tsx --tsconfig services/mqtt-ingest/tsconfig.json services/mqtt-ingest/index.ts
```

## Environment

| Variable | Required | Default |
|---|---|---|
| `MQTT_BROKER_URL` | no | `mqtts://localhost:8883` |
| `MQTT_USERNAME` | no | `ts-backend` |
| `MQTT_PASSWORD` | prod | — |
| `MQTT_CA_PATH` | mTLS | — |
| `MQTT_CERT_PATH` | mTLS | — |
| `MQTT_KEY_PATH` | mTLS | — |
| `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` | yes | — |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | — |
| `DLQ_PATH` | no | `./services/mqtt-ingest/dlq.jsonl` |

## Observability

Every 60 s the service logs a throughput line:

```
[ingest] 60s: telemetry=42 heartbeat=3 events=1 errors=0 dlq=0 …
```

Errors during a handler are counted in `errors`; DLQ writes are
counted separately.

## Integration test (manual)

One terminal — broker + simulator:

```bash
cd infra/mqtt && docker compose up -d
pnpm tsx tools/gateway-simulator/simulator.ts \
  --site-id=<REAL_SITE_UUID> --meters=3 --telemetry-ms=5000
```

Another terminal — ingest:

```bash
pnpm tsx --tsconfig services/mqtt-ingest/tsconfig.json services/mqtt-ingest/index.ts
```

Verify in Supabase after ~30 s:

```sql
select count(*), max(timestamp) from telemetry
  where meter_id in (select id from meters where site_id='<SITE_UUID>');

select * from transactions
  where created_at > now() - interval '1 minute'
  order by created_at desc;
```

The `<SITE_UUID>` must match a real row in `public.sites` with a
`gateway` and `meters` already provisioned, otherwise `processReading`
returns `no_active_connection` and no transactions will appear —
which is itself a correct response; check `billing_audit` for the
`reading_received` rows to confirm the pipeline ran.

## Graceful shutdown

SIGINT / SIGTERM drain the MQTT connection and exit. A 5 s watchdog
forces exit if drain stalls.
