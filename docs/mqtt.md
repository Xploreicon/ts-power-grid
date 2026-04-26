# MQTT — T&S Gateway Hub

The Gateway Hub is the device installed at each host site. It reads the
bi-directional meter(s), reports telemetry to the backend, and executes
commands (disconnect, reconnect, firmware update, etc.). All gateway ↔
backend communication flows through an MQTT broker over mTLS.

## Topology

```
  Gateway (Raspberry Pi, at site)
      │
      │  MQTT over TLS 1.3, mTLS client cert
      ▼
  EMQX broker (DigitalOcean / HiveMQ Cloud)
      │
      ├─► mqtt-ingest service  (subscribes to ts/#, writes to Supabase)
      └◄─ publisher (lib/mqtt/publisher.ts, called from Next.js API routes)
```

## Topic structure

All topics are under the `ts/` root and scoped by `site_id`.

| Topic | Direction | QoS | Payload |
|---|---|---|---|
| `ts/sites/{site_id}/meters/{meter_id}/telemetry` | gateway → cloud | 1 | `{ meter_id, cumulative_kwh, connected, timestamp }` |
| `ts/sites/{site_id}/gateway/heartbeat` | gateway → cloud | 1 | `{ site_id, uptime_sec, firmware_version, free_disk_mb, timestamp }` |
| `ts/sites/{site_id}/events` | gateway → cloud | 1 | `{ event, ..., timestamp }` (tamper, fault, offline, command_ack) |
| `ts/sites/{site_id}/commands` | cloud → gateway | 1 | `{ command_id, type, issued_at, ...command-specific }` |

Telemetry is published every 30 s; heartbeat every 5 min. Timestamps
are ISO-8601 UTC. `cumulative_kwh` is the meter's lifetime kWh — the
billing engine derives consumption as the delta between consecutive
readings.

## Command reference

Commands are JSON objects carrying a `command_id` (UUID) and `type`
field. The gateway ack's each command by publishing a
`command_ack` event on `ts/sites/{site_id}/events`.

| Command | Payload | Effect |
|---|---|---|
| `disconnect_meter` | `{ meter_id, reason? }` | Opens the meter relay — no power to neighbor. |
| `reconnect_meter` | `{ meter_id }` | Closes the relay. |
| `update_price` | `{ price_kobo_per_kwh }` | Updates local pricing cache (fallback if cloud unreachable). |
| `reboot_gateway` | `{}` | Soft reboot of the Pi. |
| `update_firmware` | `{ version, url, sha256 }` | Pull + verify + apply OTA update. |

Example — publishing from a server route:

```ts
import { publishCommand } from "@/lib/mqtt/publisher";

await publishCommand(siteId, {
  type: "disconnect_meter",
  meter_id,
  reason: "wallet_depleted",
});
```

## Security

* **mTLS on port 8883.** Every gateway has a client cert minted at
  manufacturing time. The cert's CN equals the gateway's `site_id`.
* **ACL via cert CN.** `infra/mqtt/acl.conf` restricts each gateway
  to publishing on its own `ts/sites/${cert_common_name}/…` topics
  and subscribing only to its own commands. Default is deny.
* **Backend identity.** The ingest service and publisher authenticate
  with the server-side username `ts-backend` and a credential held in
  secrets, with broad `ts/#` access.
* **Rotation.** Certs expire in 1 year; revocation via CRL pushed to
  EMQX. Provisioning script (phase 2) handles mint + deploy.

## Local development

### 1. Generate dev certs

```bash
cd infra/mqtt/certs
# follow the openssl commands in certs/README.md
```

### 2. Start the broker

```bash
cd infra/mqtt
docker compose up -d
```

Dashboard: <http://localhost:18083> (user `admin`, password from
`EMQX_DASHBOARD_PASSWORD` env).

### 3. Run the simulator

```bash
export MQTT_BROKER_URL=mqtt://localhost:1883  # plain for dev, or mqtts://
pnpm tsx tools/gateway-simulator/simulator.ts \
  --site-id=00000000-0000-0000-0000-000000000001 \
  --meters=3
```

The simulator will publish telemetry every 30 s and heartbeat every
5 min. Send it a command from another terminal:

```bash
# from the same repo
pnpm tsx -e '
  import("./lib/mqtt/publisher").then(async (m) => {
    const r = await m.publishCommand(
      "00000000-0000-0000-0000-000000000001",
      { type: "disconnect_meter", meter_id: "PUT-METER-ID-HERE" },
    );
    console.log(r);
    await m.closePublisher();
  });
'
```

The simulator will log the incoming command and publish a
`command_ack` event.

## Troubleshooting

**`CONNECT` fails with `not_authorized`** — check the cert CN matches
the `site_id` you're using; the ACL denies any mismatch.

**`PUBLISH` silently dropped** — EMQX logs ACL denials at `debug`
level. Enable via dashboard → Log → set level to `debug`.

**`queueQoSZero: false` and publish rejects on disconnect** — by
design. The publisher surfaces broker unavailability to callers so
they can fall back (e.g. retry later, mark command pending in DB).

## Phase 2+

This file covers phase 1 (broker + publisher + simulator + docs).
See the prompt library for the remaining phases: ingest service,
admin fleet UI, Python firmware, OTA/cert rotation.
