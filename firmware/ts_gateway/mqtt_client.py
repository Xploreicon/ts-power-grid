"""MQTT client wrapper.

Owns the paho connection, topic naming, and the command subscription
plumbing. Publishes go through `publish_telemetry()` / `publish_event()`
/ `publish_heartbeat()` — callers never touch raw paho APIs.

Offline behaviour: publishes return False when disconnected so the
caller can fall back to the local queue. Paho's own retry handles
transient TCP flaps within the keepalive window.
"""
from __future__ import annotations

import json
import logging
import ssl
import threading
import time
from typing import Callable, Optional

try:
    import paho.mqtt.client as mqtt
except ImportError:
    mqtt = None  # type: ignore[assignment]

from .config import Config

log = logging.getLogger(__name__)

CommandCallback = Callable[[dict], None]


class MqttClient:
    def __init__(self, config: Config, on_command: CommandCallback):
        self._cfg = config
        self._site_id = config.site_id
        self._on_command = on_command
        self._connected = threading.Event()
        self._client: Optional[object] = None  # paho.mqtt.client.Client
        self._command_topic = f"ts/sites/{self._site_id}/commands"
        self._events_topic = f"ts/sites/{self._site_id}/events"
        self._heartbeat_topic = f"ts/sites/{self._site_id}/gateway/heartbeat"

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    def connect(self) -> None:
        if mqtt is None:
            raise RuntimeError(
                "paho-mqtt is not installed — `pip install -r requirements.txt`"
            )
        client = mqtt.Client(
            client_id=f"gw-{self._site_id}",
            protocol=mqtt.MQTTv5,
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        )
        # TLS configuration — three modes, picked by which fields are set:
        #
        #   1. mTLS: client_cert + client_key (+ optional ca_cert).
        #      Used by EMQX with cert-CN-keyed ACL. CA pin recommended.
        #   2. Username/password over TLS with a public CA: ca_cert empty,
        #      client_cert/client_key empty. Used by HiveMQ Cloud.
        #   3. Username/password over TLS with a private CA: ca_cert set,
        #      client_cert/client_key empty.
        #
        # paho's `tls_set` accepts None for any of the three paths, but
        # passing an empty string raises FileNotFoundError. Coerce to
        # None up-front so YAML omissions and explicit "" both work.
        ca = self._cfg.mqtt.ca_cert or None
        cert = self._cfg.mqtt.client_cert or None
        key = self._cfg.mqtt.client_key or None
        client.tls_set(
            ca_certs=ca,
            certfile=cert,
            keyfile=key,
            tls_version=ssl.PROTOCOL_TLSv1_2,
        )

        # SASL credentials — when set, the broker authenticates the
        # connection via username/password rather than (or alongside)
        # mTLS. Skipped entirely when both fields are empty.
        if self._cfg.mqtt.username:
            client.username_pw_set(
                self._cfg.mqtt.username,
                self._cfg.mqtt.password or None,
            )
        # Last-will — broker publishes this if the socket drops without
        # a clean DISCONNECT. Backend flips the gateway to offline.
        will = {
            "site_id": self._site_id,
            "status": "offline",
            "reason": "lwt",
            "timestamp": _iso_now(),
        }
        client.will_set(
            self._heartbeat_topic,
            payload=json.dumps(will),
            qos=1,
            retain=False,
        )

        client.on_connect = self._on_connect
        client.on_disconnect = self._on_disconnect
        client.on_message = self._on_message

        log.info(
            "connecting to %s:%d as gw-%s",
            self._cfg.mqtt.host, self._cfg.mqtt.port, self._site_id,
        )
        client.connect(
            self._cfg.mqtt.host,
            self._cfg.mqtt.port,
            keepalive=self._cfg.mqtt.keepalive_sec,
        )
        client.loop_start()
        self._client = client

    def disconnect(self) -> None:
        if self._client is None:
            return
        try:
            self._client.loop_stop()  # type: ignore[attr-defined]
            self._client.disconnect()  # type: ignore[attr-defined]
        except Exception as exc:  # pylint: disable=broad-except
            log.warning("mqtt disconnect error: %s", exc)
        self._client = None
        self._connected.clear()

    def is_connected(self) -> bool:
        return self._connected.is_set()

    # ------------------------------------------------------------------
    # Paho callbacks
    # ------------------------------------------------------------------
    def _on_connect(self, client, _userdata, _flags, reason_code, _props=None):
        if getattr(reason_code, "value", reason_code) != 0:
            log.error("mqtt connect failed: %s", reason_code)
            return
        self._connected.set()
        log.info("mqtt connected; subscribing to %s", self._command_topic)
        client.subscribe(self._command_topic, qos=1)

    def _on_disconnect(self, _client, _userdata, _flags, reason_code, _props=None):
        self._connected.clear()
        log.warning("mqtt disconnected (%s)", reason_code)

    def _on_message(self, _client, _userdata, msg):
        try:
            payload = json.loads(msg.payload.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            log.error("malformed command payload: %s", exc)
            return
        if not isinstance(payload, dict):
            log.error("command payload is not an object")
            return
        log.info("command received: %s", payload.get("type"))
        try:
            self._on_command(payload)
        except Exception as exc:  # pylint: disable=broad-except
            log.exception("command handler crashed: %s", exc)

    # ------------------------------------------------------------------
    # Publishes
    # ------------------------------------------------------------------
    def publish_telemetry(
        self, meter_id: str, payload: dict, qos: int = 1
    ) -> bool:
        topic = f"ts/sites/{self._site_id}/meters/{meter_id}/telemetry"
        return self._publish(topic, payload, qos)

    def publish_heartbeat(self, payload: dict) -> bool:
        return self._publish(self._heartbeat_topic, payload, qos=1)

    def publish_event(self, payload: dict) -> bool:
        return self._publish(self._events_topic, payload, qos=1)

    def _publish(self, topic: str, payload: dict, qos: int) -> bool:
        if self._client is None or not self._connected.is_set():
            return False
        info = self._client.publish(  # type: ignore[attr-defined]
            topic, json.dumps(payload), qos=qos, retain=False
        )
        # PUBACK is delivered asynchronously; wait briefly so QoS1
        # callers know the broker received the message.
        try:
            info.wait_for_publish(timeout=5)
        except Exception:  # pylint: disable=broad-except
            return False
        return bool(info.is_published())


def _iso_now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
