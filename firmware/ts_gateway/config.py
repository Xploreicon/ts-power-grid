"""Config loader — parses YAML into typed dataclasses.

Kept deliberately minimal; any validation beyond "required key present"
lives in the module that uses the field.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml


@dataclass
class MqttConfig:
    host: str
    port: int
    # All TLS material is optional. Leave empty to use the system trust
    # store (HiveMQ Cloud and other public-CA brokers); set just
    # `ca_cert` to pin a private CA; set all three for mTLS to a
    # broker that authenticates clients by certificate.
    ca_cert: str = ""
    client_cert: str = ""
    client_key: str = ""
    # Username + password are read from the MQTT_USERNAME / MQTT_PASSWORD
    # environment variables at config.load() time so we never commit
    # secrets to config.yaml. Empty strings = no SASL credentials sent
    # (relevant when authenticating purely via mTLS).
    username: str = ""
    password: str = ""
    keepalive_sec: int = 60
    will_topic_suffix: str = "gateway/heartbeat"


@dataclass
class Intervals:
    meter_poll_sec: int = 30
    meter_stagger_sec: int = 2
    heartbeat_sec: int = 300
    health_alert_sec: int = 60


@dataclass
class OfflineQueue:
    # `None` → LocalQueue picks a package-relative default (firmware/data/queue.db),
    # which keeps `--dry-run` working on a dev laptop without root-owned paths.
    # Production installs set this to /var/lib/ts-gateway/queue.db via config.yaml.
    db_path: str | None = None
    max_age_hours: int = 72
    drain_batch: int = 100


@dataclass
class ModbusConfig:
    port: str = "/dev/ttyUSB0"
    baudrate: int = 9600
    parity: str = "N"
    stopbits: int = 1
    bytesize: int = 8
    timeout_sec: int = 2


@dataclass
class MeterConfig:
    id: str
    driver: str
    modbus_address: int
    role: str = "neighbor"
    # BCM pin number of the contactor wired to this meter. Only used by
    # drivers that delegate relay control to the GPIO (e.g. pzem004t);
    # drivers with on-board relays (hexing_hxe110) ignore it.
    relay_pin: int | None = None


@dataclass
class Thresholds:
    cpu_temp_c: float = 80.0
    disk_used_pct: float = 90.0
    mem_used_pct: float = 90.0


@dataclass
class Config:
    site_id: str
    mqtt: MqttConfig
    intervals: Intervals
    offline_queue: OfflineQueue
    modbus: ModbusConfig
    meters: list[MeterConfig]
    thresholds: Thresholds
    # BCM pin numbers reserved for the relay module's channels. Each
    # MeterConfig.relay_pin must reference one of these. Empty list =
    # no relay hardware on this gateway.
    relay_pins: list[int] = field(default_factory=list)
    log_level: str = "INFO"


def load(path: str | Path) -> Config:
    raw: dict[str, Any] = yaml.safe_load(Path(path).read_text())
    # MQTT credentials live in the environment, not the YAML — keeps
    # secrets out of git and lets a single config.yaml ship across
    # dev/staging/prod with only the broker creds rotating per env.
    mqtt_raw = dict(raw.get("mqtt", {}))
    mqtt_raw.setdefault("username", os.environ.get("MQTT_USERNAME", ""))
    mqtt_raw.setdefault("password", os.environ.get("MQTT_PASSWORD", ""))
    return Config(
        site_id=str(raw["site_id"]),
        mqtt=MqttConfig(**mqtt_raw),
        intervals=Intervals(**raw.get("intervals", {})),
        offline_queue=OfflineQueue(**raw.get("offline_queue", {})),
        modbus=ModbusConfig(**raw.get("modbus", {})),
        meters=[MeterConfig(**m) for m in raw.get("meters", [])],
        thresholds=Thresholds(**raw.get("thresholds", {})),
        relay_pins=list(raw.get("relay_pins", [])),
        log_level=str(raw.get("logging", {}).get("level", "INFO")),
    )
