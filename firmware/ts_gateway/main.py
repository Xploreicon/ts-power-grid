"""ts-gateway main entry point.

Wires every module together and runs the main loop. Threads:
  - meter_reader   : polls Modbus, calls back on every reading
  - mqtt_client    : paho network loop (started by paho internally)
  - main           : telemetry publish + heartbeat tick + queue drain
"""
from __future__ import annotations

import argparse
import json
import logging
import signal
import sys
import threading
import time
from pathlib import Path

from . import __version__, config as config_mod
from .command_handler import CommandHandler
from .health import sample as sample_health, check_thresholds, to_dict as health_to_dict
from .local_db import LocalQueue
from .meter_reader import MeterReader
from .meters import MeterReading
from .mqtt_client import MqttClient

log = logging.getLogger(__name__)


def default_config_path() -> Path:
    """Prefer the production config at /etc/ts-gateway/config.yaml when it
    exists; otherwise fall back to the package-shipped config.yaml so local
    dev (`python3 -m ts_gateway.main --dry-run` on a Mac) works without
    root access or any extra flags."""
    prod = Path("/etc/ts-gateway/config.yaml")
    if prod.exists():
        return prod
    return Path(__file__).resolve().parent / "config.yaml"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="ts-gateway")
    parser.add_argument(
        "--config",
        default=str(default_config_path()),
        help="Path to config.yaml (default: /etc/ts-gateway/config.yaml if "
             "present, else the package-shipped config)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Read meters and queue readings locally, but never publish to MQTT",
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"ts-gateway {__version__}",
    )
    return parser.parse_args()


def build_modbus_client(cfg):
    """Real pymodbus client, or None when drivers are all simulators."""
    only_sim = all(m.driver == "simulator" for m in cfg.meters)
    if only_sim:
        return None
    try:
        from pymodbus.client import ModbusSerialClient
    except ImportError:
        log.error("pymodbus not installed and non-simulator drivers configured")
        raise
    client = ModbusSerialClient(
        port=cfg.modbus.port,
        baudrate=cfg.modbus.baudrate,
        parity=cfg.modbus.parity,
        stopbits=cfg.modbus.stopbits,
        bytesize=cfg.modbus.bytesize,
        timeout=cfg.modbus.timeout_sec,
    )
    if not client.connect():
        log.error("failed to open modbus port %s", cfg.modbus.port)
    return client


def setup_logging(level: str) -> None:
    logging.basicConfig(
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        level=getattr(logging, level.upper(), logging.INFO),
    )


def iso_utc(ts: float) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(ts))


class Gateway:
    def __init__(self, cfg, dry_run: bool):
        self.cfg = cfg
        self.dry_run = dry_run
        self.stop_event = threading.Event()
        self.queue = LocalQueue(
            db_path=cfg.offline_queue.db_path,
            max_age_seconds=cfg.offline_queue.max_age_hours * 3600,
        )

        self.mqtt = MqttClient(cfg, on_command=self._on_command_msg)
        modbus_client = build_modbus_client(cfg)
        self.reader = MeterReader(
            cfg,
            modbus_client=modbus_client,
            on_reading=self._on_reading,
            on_event=self._on_event,
        )
        self.commands = CommandHandler(
            publish_event=self._publish_event,
            meter_reader=self.reader,
            enable_reboot=False,  # flip to True only in prod
        )

    # ------------------------------------------------------------------
    # Callbacks wired into the sub-modules
    # ------------------------------------------------------------------
    def _on_reading(self, meter, reading: MeterReading, ts: float) -> None:
        payload = {
            "meter_id": meter.id,
            "cumulative_kwh": reading.cumulative_kwh,
            "voltage": reading.voltage,
            "current": reading.current,
            "power_factor": reading.power_factor,
            "role": meter.role,
            "timestamp": iso_utc(ts),
        }
        if self.dry_run:
            log.info("(dry) would publish telemetry: %s", payload)
            return
        published = self.mqtt.publish_telemetry(meter.id, payload)
        if not published:
            self.queue.enqueue(
                meter_id=meter.id,
                cumulative_kwh=reading.cumulative_kwh,
                timestamp_utc=payload["timestamp"],
                payload=payload,
            )
            log.debug("queued offline reading for %s", meter.id)

    def _on_event(self, kind: str, detail: dict) -> None:
        self._publish_event({"event": kind, "timestamp": iso_utc(time.time()), **detail})

    def _on_command_msg(self, command: dict) -> None:
        self.commands.handle(command)

    def _publish_event(self, payload: dict) -> bool:
        if self.dry_run:
            log.info("(dry) would publish event: %s", payload)
            return True
        return self.mqtt.publish_event(payload)

    # ------------------------------------------------------------------
    # Loops
    # ------------------------------------------------------------------
    def run(self) -> None:
        if not self.dry_run:
            try:
                self.mqtt.connect()
            except Exception as exc:  # pylint: disable=broad-except
                log.error("mqtt connect failed at startup: %s", exc)
                # Keep running — the reader still writes to the local
                # queue and the mqtt client's own reconnect loop will
                # eventually land.
        self.reader.start()
        last_heartbeat = 0.0

        while not self.stop_event.is_set():
            now = time.time()
            if now - last_heartbeat >= self.cfg.intervals.heartbeat_sec:
                self._emit_heartbeat()
                last_heartbeat = now

            if not self.dry_run and self.mqtt.is_connected():
                self._drain_queue()

            # Housekeeping — purge stale queue rows.
            dropped = self.queue.purge_expired()
            if dropped:
                log.info("purged %d expired queue rows", dropped)

            self.stop_event.wait(5.0)

        log.info("shutting down")
        self.reader.stop()
        self.mqtt.disconnect()

    def _emit_heartbeat(self) -> None:
        snap = sample_health()
        payload = {
            "site_id": self.cfg.site_id,
            "firmware_version": __version__,
            "queue_depth": self.queue.depth(),
            "timestamp": iso_utc(time.time()),
            **health_to_dict(snap),
        }
        if self.dry_run:
            log.info("(dry) heartbeat: %s", payload)
        else:
            self.mqtt.publish_heartbeat(payload)

        breaches = check_thresholds(
            snap,
            cpu_temp_c=self.cfg.thresholds.cpu_temp_c,
            disk_used_pct=self.cfg.thresholds.disk_used_pct,
            mem_used_pct=self.cfg.thresholds.mem_used_pct,
        )
        for alert in breaches:
            self._publish_event({
                "event": "health_breach",
                "timestamp": iso_utc(time.time()),
                **alert,
            })

    def _drain_queue(self) -> None:
        batch = self.queue.drain(self.cfg.offline_queue.drain_batch)
        if not batch:
            return
        acked: list[int] = []
        for row_id, payload in batch:
            meter_id = str(payload.get("meter_id") or "")
            if not meter_id:
                acked.append(row_id)  # bad row, drop it
                continue
            if self.mqtt.publish_telemetry(meter_id, payload):
                acked.append(row_id)
            else:
                break  # broker went away mid-drain; try again next tick
        if acked:
            self.queue.ack(acked)
            log.info("drained %d queued reading(s)", len(acked))

    def stop(self) -> None:
        self.stop_event.set()


def main() -> int:
    args = parse_args()
    cfg_path = Path(args.config)
    if not cfg_path.exists():
        print(f"config not found: {cfg_path}", file=sys.stderr)
        return 2
    cfg = config_mod.load(cfg_path)
    setup_logging(cfg.log_level)
    log.info("ts-gateway %s starting (site_id=%s dry_run=%s)",
             __version__, cfg.site_id, args.dry_run)

    gw = Gateway(cfg, dry_run=args.dry_run)
    signal.signal(signal.SIGINT, lambda *_: gw.stop())
    signal.signal(signal.SIGTERM, lambda *_: gw.stop())
    gw.run()
    return 0


if __name__ == "__main__":
    sys.exit(main())
