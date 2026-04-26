/**
 * T&S gateway simulator.
 *
 * Spins up a fake gateway that publishes telemetry + heartbeats and
 * responds to commands, so backend development doesn't wait on hardware.
 *
 * Usage:
 *   pnpm tsx tools/gateway-simulator/simulator.ts --site-id=UUID --meters=3
 *
 * Environment:
 *   MQTT_BROKER_URL   default mqtt://localhost:1883  (mqtts://... for mTLS)
 *   MQTT_CA_PATH      CA cert for TLS
 *   MQTT_CERT_PATH    client cert (CN must equal --site-id for EMQX ACL)
 *   MQTT_KEY_PATH     client key
 */

import mqtt, { type IClientOptions } from "mqtt";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

interface Args {
  siteId: string;
  meterCount: number;
  telemetryIntervalMs: number;
  heartbeatIntervalMs: number;
}

function parseArgs(argv: string[]): Args {
  const get = (name: string) => {
    const pref = `--${name}=`;
    const hit = argv.find((a) => a.startsWith(pref));
    return hit?.slice(pref.length);
  };
  const siteId = get("site-id");
  if (!siteId) throw new Error("--site-id=<uuid> is required");
  const meterCount = Number(get("meters") ?? "1");
  if (!Number.isFinite(meterCount) || meterCount < 1) {
    throw new Error("--meters must be a positive integer");
  }
  return {
    siteId,
    meterCount,
    telemetryIntervalMs: Number(get("telemetry-ms") ?? "30000"),
    heartbeatIntervalMs: Number(get("heartbeat-ms") ?? "300000"),
  };
}

function buildMqttOptions(siteId: string): IClientOptions {
  const opts: IClientOptions = {
    clientId: `sim-${siteId}-${randomUUID().slice(0, 8)}`,
    reconnectPeriod: 2000,
    connectTimeout: 10_000,
    protocolVersion: 5,
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
  };
  if (process.env.MQTT_CA_PATH) opts.ca = readFileSync(process.env.MQTT_CA_PATH);
  if (process.env.MQTT_CERT_PATH) opts.cert = readFileSync(process.env.MQTT_CERT_PATH);
  if (process.env.MQTT_KEY_PATH) opts.key = readFileSync(process.env.MQTT_KEY_PATH);
  return opts;
}

interface SimMeter {
  id: string;
  cumulativeKwh: number;
  connected: boolean;
}

function seedMeters(count: number): SimMeter[] {
  return Array.from({ length: count }, () => ({
    id: randomUUID(),
    // Start between 100 and 5000 kWh to feel like a real meter that's
    // been deployed for a while.
    cumulativeKwh: Math.round((100 + Math.random() * 4900) * 100) / 100,
    connected: true,
  }));
}

function tickMeter(meter: SimMeter, elapsedSec: number): void {
  if (!meter.connected) return;
  // Nigerian residential draws typically sit 0.2–1.5 kW with spikes.
  // Model as a noisy baseline around 0.6 kW.
  const kw = Math.max(0, 0.6 + (Math.random() - 0.5) * 0.8);
  const deltaKwh = (kw * elapsedSec) / 3600;
  meter.cumulativeKwh = Math.round((meter.cumulativeKwh + deltaKwh) * 1000) / 1000;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const brokerUrl = process.env.MQTT_BROKER_URL ?? "mqtt://localhost:1883";
  const opts = buildMqttOptions(args.siteId);
  const meters = seedMeters(args.meterCount);

  console.log(`[sim ${args.siteId.slice(0, 8)}] connecting to ${brokerUrl}`);
  console.log(`[sim] simulating ${args.meterCount} meter(s):`);
  for (const m of meters) console.log(`       ${m.id}  (start ${m.cumulativeKwh} kWh)`);

  const client = mqtt.connect(brokerUrl, opts);
  const commandTopic = `ts/sites/${args.siteId}/commands`;
  const eventsTopic = `ts/sites/${args.siteId}/events`;
  const heartbeatTopic = `ts/sites/${args.siteId}/gateway/heartbeat`;
  const bootedAt = Date.now();

  client.on("connect", () => {
    console.log("[sim] connected");
    client.subscribe(commandTopic, { qos: 1 }, (err) => {
      if (err) console.error("[sim] subscribe failed:", err.message);
      else console.log(`[sim] listening on ${commandTopic}`);
    });
  });

  client.on("error", (err) => console.error("[sim] mqtt error:", err.message));
  client.on("reconnect", () => console.log("[sim] reconnecting…"));

  client.on("message", (topic, buf) => {
    if (topic !== commandTopic) return;
    let cmd: Record<string, unknown>;
    try {
      cmd = JSON.parse(buf.toString("utf8"));
    } catch {
      console.error("[sim] could not parse command payload");
      return;
    }
    console.log("[sim] command received:", cmd);
    handleCommand(cmd, meters, (ev) => {
      client.publish(eventsTopic, JSON.stringify(ev), { qos: 1 });
    });
  });

  const telemetryTimer = setInterval(() => {
    for (const meter of meters) {
      tickMeter(meter, args.telemetryIntervalMs / 1000);
      const topic = `ts/sites/${args.siteId}/meters/${meter.id}/telemetry`;
      const payload = JSON.stringify({
        meter_id: meter.id,
        cumulative_kwh: meter.cumulativeKwh,
        connected: meter.connected,
        timestamp: new Date().toISOString(),
      });
      client.publish(topic, payload, { qos: 1 });
    }
  }, args.telemetryIntervalMs);

  const heartbeatTimer = setInterval(() => {
    const payload = JSON.stringify({
      site_id: args.siteId,
      uptime_sec: Math.round((Date.now() - bootedAt) / 1000),
      firmware_version: "sim-0.1.0",
      free_disk_mb: 2048,
      timestamp: new Date().toISOString(),
    });
    client.publish(heartbeatTopic, payload, { qos: 1 });
  }, args.heartbeatIntervalMs);

  const shutdown = () => {
    console.log("\n[sim] shutting down…");
    clearInterval(telemetryTimer);
    clearInterval(heartbeatTimer);
    client.end(false, {}, () => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

function handleCommand(
  cmd: Record<string, unknown>,
  meters: SimMeter[],
  publishEvent: (ev: Record<string, unknown>) => void,
): void {
  const commandId = typeof cmd.command_id === "string" ? cmd.command_id : "unknown";
  const type = cmd.type;
  const ack = (status: "applied" | "rejected", detail?: Record<string, unknown>) =>
    publishEvent({
      event: "command_ack",
      command_id: commandId,
      command_type: type,
      status,
      timestamp: new Date().toISOString(),
      ...detail,
    });

  switch (type) {
    case "disconnect_meter": {
      const id = String(cmd.meter_id ?? "");
      const meter = meters.find((m) => m.id === id);
      if (!meter) return ack("rejected", { reason: "unknown_meter" });
      meter.connected = false;
      return ack("applied");
    }
    case "reconnect_meter": {
      const id = String(cmd.meter_id ?? "");
      const meter = meters.find((m) => m.id === id);
      if (!meter) return ack("rejected", { reason: "unknown_meter" });
      meter.connected = true;
      return ack("applied");
    }
    case "update_price":
      return ack("applied", { new_price_kobo: cmd.price_kobo_per_kwh });
    case "reboot_gateway":
      ack("applied");
      console.log("[sim] (reboot requested — simulator continues running)");
      return;
    case "update_firmware":
      return ack("applied", { new_version: cmd.version });
    default:
      return ack("rejected", { reason: "unknown_command" });
  }
}

main().catch((err) => {
  console.error("[sim] fatal:", err);
  process.exit(1);
});
