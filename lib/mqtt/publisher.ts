import mqtt, { type MqttClient, type IClientOptions } from "mqtt";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

/**
 * Command publisher for the T&S Gateway Hub.
 *
 * A single MqttClient is reused across calls (connection pooling via the
 * broker's native keep-alive) — creating a new TCP/TLS connection per
 * command would burn handshakes and tickle EMQX connection limits.
 */

export type GatewayCommand =
  | { type: "disconnect_meter"; meter_id: string; reason?: string }
  | { type: "reconnect_meter"; meter_id: string }
  | { type: "update_price"; price_kobo_per_kwh: number }
  | { type: "reboot_gateway" }
  | { type: "update_firmware"; version: string; url: string; sha256: string };

export interface PublishResult {
  commandId: string;
  publishedAt: string;
}

interface PublisherConfig {
  brokerUrl: string;
  username?: string;
  password?: string;
  ca?: Buffer;
  cert?: Buffer;
  key?: Buffer;
  clientId?: string;
}

function readConfigFromEnv(): PublisherConfig {
  const brokerUrl = process.env.MQTT_BROKER_URL ?? "mqtts://localhost:8883";
  const cfg: PublisherConfig = {
    brokerUrl,
    clientId: process.env.MQTT_CLIENT_ID ?? `ts-backend-${randomUUID()}`,
    username: process.env.MQTT_USERNAME ?? "ts-backend",
    password: process.env.MQTT_PASSWORD,
  };
  if (process.env.MQTT_CA_PATH) cfg.ca = readFileSync(process.env.MQTT_CA_PATH);
  if (process.env.MQTT_CERT_PATH) cfg.cert = readFileSync(process.env.MQTT_CERT_PATH);
  if (process.env.MQTT_KEY_PATH) cfg.key = readFileSync(process.env.MQTT_KEY_PATH);
  return cfg;
}

let cached: MqttClient | null = null;
let connectPromise: Promise<MqttClient> | null = null;

async function getClient(): Promise<MqttClient> {
  if (cached && cached.connected) return cached;
  if (connectPromise) return connectPromise;

  const cfg = readConfigFromEnv();
  const opts: IClientOptions = {
    clientId: cfg.clientId,
    username: cfg.username,
    password: cfg.password,
    ca: cfg.ca,
    cert: cfg.cert,
    key: cfg.key,
    reconnectPeriod: 2000,
    connectTimeout: 10_000,
    // Queue outgoing messages during brief disconnects. The publisher
    // awaits the puback, so callers see a reject if the broker is down.
    queueQoSZero: false,
    protocolVersion: 5,
  };

  connectPromise = new Promise<MqttClient>((resolve, reject) => {
    const client = mqtt.connect(cfg.brokerUrl, opts);
    const onConnect = () => {
      client.off("error", onError);
      cached = client;
      connectPromise = null;
      resolve(client);
    };
    const onError = (err: Error) => {
      client.off("connect", onConnect);
      client.end(true);
      connectPromise = null;
      reject(err);
    };
    client.once("connect", onConnect);
    client.once("error", onError);
  });
  return connectPromise;
}

/**
 * Publish a command to a specific site's gateway.
 *
 * Uses QoS 1 — broker acknowledges receipt, so we know the command
 * reached the broker (not necessarily the gateway; the gateway acks
 * via its own events channel when the command completes).
 *
 * Caller is responsible for audit logging — see `audit.logCommand` in
 * lib/admin when that lands.
 */
export async function publishCommand(
  siteId: string,
  command: GatewayCommand,
): Promise<PublishResult> {
  if (!/^[0-9a-f-]{36}$/i.test(siteId)) {
    throw new Error(`invalid site_id: ${siteId}`);
  }
  const client = await getClient();
  const commandId = randomUUID();
  const publishedAt = new Date().toISOString();
  const topic = `ts/sites/${siteId}/commands`;
  const payload = JSON.stringify({
    command_id: commandId,
    issued_at: publishedAt,
    ...command,
  });

  await new Promise<void>((resolve, reject) => {
    client.publish(topic, payload, { qos: 1, retain: false }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  return { commandId, publishedAt };
}

/**
 * Publish a relay open/close to `ts/sites/{siteId}/commands/relay`.
 *
 * Relay control lives on its own sub-topic — separate from the
 * generic `commands` topic that carries reboots / firmware updates —
 * so the broker ACL can grant relay-publish to the billing path
 * without granting full command authority.
 *
 * `open`  = relay open  = power CUT
 * `close` = relay closed = power FLOWING
 *
 * (Yes, the polarity is inverse to most consumer language. We use
 * the relay's electrical state because that's what the firmware
 * acts on.)
 */
export async function publishRelay(
  siteId: string,
  meterId: string,
  action: "open" | "close",
): Promise<PublishResult> {
  if (!/^[0-9a-f-]{36}$/i.test(siteId)) {
    throw new Error(`invalid site_id: ${siteId}`);
  }
  if (!/^[0-9a-f-]{36}$/i.test(meterId)) {
    throw new Error(`invalid meter_id: ${meterId}`);
  }
  const client = await getClient();
  const commandId = randomUUID();
  const publishedAt = new Date().toISOString();
  const topic = `ts/sites/${siteId}/commands/relay`;
  const payload = JSON.stringify({
    command_id: commandId,
    issued_at: publishedAt,
    meter_id: meterId,
    action,
  });

  await new Promise<void>((resolve, reject) => {
    client.publish(topic, payload, { qos: 1, retain: false }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  return { commandId, publishedAt };
}

/** Shut down the shared connection. Call from worker teardown / tests. */
export async function closePublisher(): Promise<void> {
  const c = cached;
  cached = null;
  connectPromise = null;
  if (!c) return;
  await new Promise<void>((resolve) => c.end(false, {}, () => resolve()));
}
