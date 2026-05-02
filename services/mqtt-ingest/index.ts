/**
 * mqtt-ingest — subscribes to ts/# and persists to Supabase.
 *
 * This is a long-running standalone Node process, deployed separately
 * from the Next.js app (e.g. on fly.io, a Docker container, or a
 * DigitalOcean app). It is the only consumer of raw gateway telemetry.
 *
 * Pipeline:
 *   telemetry  → billing.processReading()            (charges, disconnects)
 *   heartbeat  → UPDATE gateways SET last_seen_at    (fleet liveness)
 *   events     → INSERT gateway_events + notify      (tamper, fault, ack)
 *
 * Unparseable or unroutable messages land in a DLQ file (append-only
 * JSONL) so they can be replayed or diffed without losing data.
 */

import mqtt, { type IClientOptions, type MqttClient } from "mqtt";
import { appendFile, mkdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  processReading,
  ReadingValidationError,
  ReadingProcessingError,
} from "./billing";

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printHelp() {
  console.log(`mqtt-ingest — T&S telemetry ingestor

Usage:
  pnpm tsx services/mqtt-ingest/index.ts [options]

Options:
  --help          show this message
  --dry-run       connect and log messages without writing to Supabase

Environment:
  MQTT_BROKER_URL        default mqtts://localhost:8883
  MQTT_USERNAME          default "ts-backend"
  MQTT_PASSWORD          backend broker credential
  MQTT_CA_PATH           CA cert (PEM) for TLS
  MQTT_CERT_PATH         backend client cert
  MQTT_KEY_PATH          backend client key
  SUPABASE_URL           required (or NEXT_PUBLIC_SUPABASE_URL)
  SUPABASE_SERVICE_ROLE_KEY required
  DLQ_PATH               default ./services/mqtt-ingest/dlq.jsonl
`);
}

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  printHelp();
  process.exit(0);
}
const DRY_RUN = argv.includes("--dry-run");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BROKER_URL = process.env.MQTT_BROKER_URL ?? "mqtts://localhost:8883";
const DLQ_PATH = resolve(
  process.env.DLQ_PATH ?? "./services/mqtt-ingest/dlq.jsonl",
);

function supabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required",
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function mqttOptions(): IClientOptions {
  const opts: IClientOptions = {
    clientId: `ts-ingest-${randomUUID().slice(0, 8)}`,
    username: process.env.MQTT_USERNAME ?? "ts-backend",
    password: process.env.MQTT_PASSWORD,
    reconnectPeriod: 2000,
    connectTimeout: 10_000,
    protocolVersion: 5,
    clean: false,
  };
  if (process.env.MQTT_CA_PATH) opts.ca = readFileSync(process.env.MQTT_CA_PATH);
  if (process.env.MQTT_CERT_PATH) opts.cert = readFileSync(process.env.MQTT_CERT_PATH);
  if (process.env.MQTT_KEY_PATH) opts.key = readFileSync(process.env.MQTT_KEY_PATH);
  return opts;
}

// ---------------------------------------------------------------------------
// Topic parsing
// ---------------------------------------------------------------------------

interface TelemetryTopic {
  kind: "telemetry";
  siteId: string;
  meterId: string;
}
interface HeartbeatTopic {
  kind: "heartbeat";
  siteId: string;
}
interface EventsTopic {
  kind: "events";
  siteId: string;
}
type ParsedTopic = TelemetryTopic | HeartbeatTopic | EventsTopic;

const UUID_RE = /^[0-9a-f-]{36}$/i;

function parseTopic(topic: string): ParsedTopic | null {
  const parts = topic.split("/");
  // ts/sites/{site}/...
  if (parts[0] !== "ts" || parts[1] !== "sites" || !parts[2]) return null;
  const siteId = parts[2];
  if (!UUID_RE.test(siteId)) return null;

  if (parts[3] === "meters" && parts[5] === "telemetry" && parts[4]) {
    if (!UUID_RE.test(parts[4])) return null;
    return { kind: "telemetry", siteId, meterId: parts[4] };
  }
  if (parts[3] === "gateway" && parts[4] === "heartbeat") {
    return { kind: "heartbeat", siteId };
  }
  if (parts[3] === "events") {
    return { kind: "events", siteId };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

const metrics = {
  telemetry: 0,
  heartbeat: 0,
  events: 0,
  errors: 0,
  dlq: 0,
};

function resetWindow() {
  return { ...metrics };
}

// ---------------------------------------------------------------------------
// DLQ
// ---------------------------------------------------------------------------

let dlqReady = false;
async function ensureDlq() {
  if (dlqReady) return;
  await mkdir(dirname(DLQ_PATH), { recursive: true });
  dlqReady = true;
}

async function deadLetter(
  reason: string,
  topic: string,
  payload: string,
  err?: unknown,
) {
  metrics.dlq += 1;
  try {
    await ensureDlq();
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      reason,
      topic,
      payload: payload.slice(0, 4096),
      error: err instanceof Error ? err.message : err ? String(err) : undefined,
    });
    await appendFile(DLQ_PATH, line + "\n", "utf8");
  } catch (writeErr) {
    console.error("[ingest] DLQ write failed:", writeErr);
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/** Statuses where the RPC actually inserts a telemetry row. */
const TELEMETRY_ROW_WRITTEN: ReadonlySet<string> = new Set([
  "first_reading",
  "host_meter",
  "flat_reading",
  "processed",
]);

async function handleTelemetry(
  supabase: SupabaseClient,
  client: MqttClient,
  parsed: TelemetryTopic,
  body: Record<string, unknown>,
): Promise<void> {
  const input = {
    meterId: parsed.meterId,
    cumulativeKwh: body.cumulative_kwh,
    timestamp: body.timestamp,
  };

  // Power-quality fields the firmware sends but the RPC doesn't write.
  const voltage =
    typeof body.voltage === "number" && isFinite(body.voltage)
      ? body.voltage
      : null;
  const current =
    typeof body.current === "number" && isFinite(body.current)
      ? body.current
      : null;
  const power_factor =
    typeof body.power_factor === "number" && isFinite(body.power_factor)
      ? body.power_factor
      : null;

  if (DRY_RUN) {
    console.log("[ingest] (dry) telemetry", {
      ...input,
      voltage,
      current,
      power_factor,
    });
    return;
  }
  try {
    const result = await processReading(supabase, input);

    // Backfill voltage / current / power_factor on the telemetry row
    // that process_meter_reading just inserted. Only attempt the
    // update when (a) the RPC actually wrote a row and (b) at least
    // one power-quality field is present in the payload.
    if (
      TELEMETRY_ROW_WRITTEN.has(result.status) &&
      (voltage !== null || current !== null || power_factor !== null)
    ) {
      const patch: Record<string, number> = {};
      if (voltage !== null) patch.voltage = voltage;
      if (current !== null) patch.current = current;
      if (power_factor !== null) patch.power_factor = power_factor;

      const { error: pqErr } = await supabase
        .from("telemetry")
        .update(patch)
        .eq("meter_id", parsed.meterId)
        .eq("timestamp", input.timestamp as string);

      if (pqErr) {
        // Non-fatal — the core reading is already persisted.
        console.error(
          "[ingest] power-quality backfill failed:",
          pqErr.message,
        );
      }
    }

    // Auto-disconnect: when the SQL function says the wallet ran dry,
    // publish a relay-open on the same broker connection. We're
    // already inside its message loop — no second connection needed.
    // The corresponding "close" (reconnect) is fired from the Next
    // app's topup flow via lib/billing/disconnect.issueReconnectCommand.
    if (result.action === "disconnect") {
      await publishRelayCommand(client, parsed.siteId, parsed.meterId, "open");
    }
  } catch (err) {
    if (err instanceof ReadingValidationError) {
      await deadLetter("telemetry_validation", `telemetry/${parsed.meterId}`, JSON.stringify(body), err);
      return;
    }
    if (err instanceof ReadingProcessingError) {
      metrics.errors += 1;
      console.error("[ingest] processReading failed:", err.message);
      return;
    }
    throw err;
  }
}

/**
 * Publish a relay command using the ingest's existing MQTT client.
 * Topic format matches `lib/mqtt/publisher.publishRelay` so the
 * gateway firmware sees a single payload shape regardless of which
 * service initiated.
 *
 * `open`  = relay open  = power CUT
 * `close` = relay closed = power FLOWING
 */
async function publishRelayCommand(
  client: MqttClient,
  siteId: string,
  meterId: string,
  action: "open" | "close",
): Promise<void> {
  const topic = `ts/sites/${siteId}/commands/relay`;
  const payload = JSON.stringify({
    command_id: randomUUID(),
    issued_at: new Date().toISOString(),
    meter_id: meterId,
    action,
  });
  await new Promise<void>((resolve, reject) => {
    client.publish(topic, payload, { qos: 1, retain: false }, (err) => {
      if (err) {
        metrics.errors += 1;
        console.error(`[ingest] relay publish failed (${action}):`, err.message);
        reject(err);
      } else {
        console.log(`[ingest] relay ${action} → ${siteId}/${meterId}`);
        resolve();
      }
    });
  });
}

async function handleHeartbeat(
  supabase: SupabaseClient,
  parsed: HeartbeatTopic,
  body: Record<string, unknown>,
): Promise<void> {
  if (DRY_RUN) {
    console.log("[ingest] (dry) heartbeat", parsed.siteId, body);
    return;
  }
  const patch: Record<string, unknown> = {
    last_seen_at: new Date().toISOString(),
    status: "online",
  };
  if (typeof body.firmware_version === "string") {
    patch.firmware_version = body.firmware_version;
  }
  const { error } = await supabase
    .from("gateways")
    .update(patch)
    .eq("site_id", parsed.siteId);
  if (error) {
    metrics.errors += 1;
    console.error("[ingest] heartbeat update failed:", error.message);
  }
}

async function handleEvent(
  supabase: SupabaseClient,
  parsed: EventsTopic,
  body: Record<string, unknown>,
): Promise<void> {
  if (DRY_RUN) {
    console.log("[ingest] (dry) event", parsed.siteId, body);
    return;
  }
  const event = typeof body.event === "string" ? body.event : "unknown";
  const severity =
    event === "tamper" || event === "fault"
      ? "critical"
      : event === "offline"
        ? "warning"
        : "info";

  // Resolve host (for notification) and gateway_id (for event FK).
  const [siteRes, gatewayRes] = await Promise.all([
    supabase.from("sites").select("host_id").eq("id", parsed.siteId).maybeSingle(),
    supabase.from("gateways").select("id").eq("site_id", parsed.siteId).maybeSingle(),
  ]);
  const site = siteRes.data;
  const gatewayId = gatewayRes.data?.id as string | undefined;

  if (!gatewayId) {
    await deadLetter("unknown_gateway", `events/${parsed.siteId}`, JSON.stringify(body));
    return;
  }

  await supabase.from("gateway_events").insert({
    gateway_id: gatewayId,
    event_type: event,
    severity,
    details: body,
  });

  // Only fault-class events page the host — command acks and routine
  // status events are noise at the notification layer. We insert
  // directly into the `notifications` table; the Next app's realtime
  // subscription picks it up and renders it. Push/email fan-out done
  // by the in-app dispatcher is intentionally skipped here so the
  // ingest stays free of the Next dependency graph.
  if (event === "tamper" || event === "fault" || event === "offline") {
    if (site?.host_id) {
      try {
        await supabase.from("notifications").insert({
          user_id: site.host_id,
          type: "system_fault_reported",
          title: `Gateway event: ${event}`,
          body: `Site ${parsed.siteId} reported ${event}.`,
          data: {
            site_id: parsed.siteId,
            event,
            detail: body,
          },
        });
      } catch (err) {
        metrics.errors += 1;
        console.error("[ingest] notification insert failed:", err);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const supabase = DRY_RUN ? (null as unknown as SupabaseClient) : supabaseClient();
  const client: MqttClient = mqtt.connect(BROKER_URL, mqttOptions());

  const topics = [
    "ts/+/meters/+/telemetry",  // legacy-style if anyone drops the "sites"
    "ts/sites/+/meters/+/telemetry",
    "ts/sites/+/gateway/heartbeat",
    "ts/sites/+/events",
  ];

  client.on("connect", () => {
    console.log(`[ingest] connected to ${BROKER_URL}${DRY_RUN ? " (dry-run)" : ""}`);
    client.subscribe(topics, { qos: 1 }, (err, granted) => {
      if (err) {
        console.error("[ingest] subscribe failed:", err.message);
        return;
      }
      console.log("[ingest] subscribed:");
      for (const g of granted ?? []) console.log(`   ${g.topic} (qos ${g.qos})`);
    });
  });

  client.on("error", (err) => console.error("[ingest] mqtt error:", err.message));
  client.on("reconnect", () => console.log("[ingest] reconnecting…"));
  client.on("offline", () => console.warn("[ingest] broker offline"));

  client.on("message", async (topic, buf) => {
    const raw = buf.toString("utf8");
    const parsed = parseTopic(topic);
    if (!parsed) {
      await deadLetter("unparseable_topic", topic, raw);
      return;
    }

    let body: Record<string, unknown>;
    try {
      const decoded = JSON.parse(raw);
      if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
        throw new Error("payload not an object");
      }
      body = decoded as Record<string, unknown>;
    } catch (err) {
      await deadLetter("invalid_json", topic, raw, err);
      return;
    }

    try {
      switch (parsed.kind) {
        case "telemetry":
          metrics.telemetry += 1;
          await handleTelemetry(supabase, client, parsed, body);
          break;
        case "heartbeat":
          metrics.heartbeat += 1;
          await handleHeartbeat(supabase, parsed, body);
          break;
        case "events":
          metrics.events += 1;
          await handleEvent(supabase, parsed, body);
          break;
      }
    } catch (err) {
      metrics.errors += 1;
      console.error(`[ingest] handler crashed on ${topic}:`, err);
      await deadLetter("handler_exception", topic, raw, err);
    }
  });

  // Metrics tick — log throughput every 60s and reset the window counters.
  let lastSnapshot = resetWindow();
  const metricsTimer = setInterval(() => {
    const now = { ...metrics };
    const delta = {
      telemetry: now.telemetry - lastSnapshot.telemetry,
      heartbeat: now.heartbeat - lastSnapshot.heartbeat,
      events: now.events - lastSnapshot.events,
      errors: now.errors - lastSnapshot.errors,
      dlq: now.dlq - lastSnapshot.dlq,
    };
    lastSnapshot = now;
    console.log(
      `[ingest] 60s: telemetry=${delta.telemetry} heartbeat=${delta.heartbeat} ` +
        `events=${delta.events} errors=${delta.errors} dlq=${delta.dlq} ` +
        `(totals ${now.telemetry}/${now.heartbeat}/${now.events}, err ${now.errors}, dlq ${now.dlq})`,
    );
  }, 60_000);

  const shutdown = (signal: string) => {
    console.log(`\n[ingest] ${signal} received — draining…`);
    clearInterval(metricsTimer);
    client.end(false, {}, () => {
      console.log("[ingest] broker connection closed");
      process.exit(0);
    });
    // Hard exit if drain stalls.
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[ingest] fatal:", err);
  process.exit(1);
});
