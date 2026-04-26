"""Meter polling loop.

Reads every configured meter on its cadence, staggered across the bus to
keep RS-485 from colliding. On IOError we retry once; if the second
attempt fails we emit a `meter_unreachable` event so the cloud knows
which meter is missing telemetry.
"""
from __future__ import annotations

import logging
import threading
import time
from typing import Callable, Optional

from .config import Config, MeterConfig
from .meters import MeterDriver, MeterReading, build_driver

log = logging.getLogger(__name__)

# Callback signatures — the caller wires these to the MQTT client + DB.
OnReading = Callable[[MeterConfig, MeterReading, float], None]
OnEvent = Callable[[str, dict], None]


class MeterReader:
    """Periodic meter poller.

    Owns the dict of drivers and a background thread that walks them
    every `meter_poll_sec` seconds. Drivers are keyed by meter config
    id so commands from the cloud can target a specific one.
    """

    def __init__(
        self,
        config: Config,
        modbus_client: Optional[object],
        on_reading: OnReading,
        on_event: OnEvent,
    ):
        self._cfg = config
        self._on_reading = on_reading
        self._on_event = on_event
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._drivers: dict[str, tuple[MeterConfig, MeterDriver]] = {}

        for meter in config.meters:
            # The simulator driver ignores the modbus client; real
            # drivers share one client across meters on the bus.
            driver = build_driver(
                meter.driver,
                client=modbus_client,
                modbus_address=meter.modbus_address,
            )
            self._drivers[meter.id] = (meter, driver)
            log.info("registered meter %s (driver=%s addr=%d)",
                     meter.id, meter.driver, meter.modbus_address)

    # ------------------------------------------------------------------
    # Command routing (exposed so command_handler can reach a driver)
    # ------------------------------------------------------------------
    def driver_for(self, meter_id: str) -> Optional[MeterDriver]:
        hit = self._drivers.get(meter_id)
        return hit[1] if hit else None

    # ------------------------------------------------------------------
    # Polling loop
    # ------------------------------------------------------------------
    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(
            target=self._run, name="meter-reader", daemon=True
        )
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=5)

    def _run(self) -> None:
        poll = self._cfg.intervals.meter_poll_sec
        stagger = self._cfg.intervals.meter_stagger_sec
        while not self._stop.is_set():
            cycle_start = time.monotonic()
            for meter, driver in self._drivers.values():
                if self._stop.is_set():
                    break
                self._read_one(meter, driver)
                # Stagger: sleep between meters so they don't hammer the bus.
                if not self._stop.is_set():
                    self._stop.wait(stagger)

            # Sleep the remainder of the poll window (if the cycle was
            # shorter than `poll`). If a cycle takes longer than `poll`,
            # run immediately — the bus is already saturated and backing
            # off buys nothing.
            elapsed = time.monotonic() - cycle_start
            remaining = max(0.0, poll - elapsed)
            self._stop.wait(remaining)

    def _read_one(self, meter: MeterConfig, driver: MeterDriver) -> None:
        for attempt in (1, 2):
            try:
                reading = driver.read_all()
                ts = time.time()
                self._on_reading(meter, reading, ts)
                return
            except Exception as exc:  # pylint: disable=broad-except
                log.warning(
                    "meter %s read attempt %d failed: %s",
                    meter.id, attempt, exc,
                )
                if attempt == 1:
                    # Give the bus a breath before the retry.
                    time.sleep(0.5)
        # Both attempts failed — emit an event and move on.
        self._on_event(
            "meter_unreachable",
            {
                "meter_id": meter.id,
                "modbus_address": meter.modbus_address,
            },
        )
