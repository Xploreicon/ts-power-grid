"""Simulated meter — mirrors the real driver interface with plausible
numbers, so the firmware can run end-to-end on a dev laptop."""
from __future__ import annotations

import random
import time
from typing import Any

from .base import MeterDriver, MeterReading


class SimulatedMeter(MeterDriver):
    """In-memory fake meter. Drift is tracked per-instance so the
    cumulative_kwh value increases monotonically across polls."""

    def __init__(self, modbus_address: int = 0, **_: Any):
        self._addr = modbus_address
        # Start between 100 and 5000 kWh to feel like a meter that's
        # been in service for a while.
        self._cumulative_kwh = random.uniform(100.0, 5000.0)
        self._last_tick = time.monotonic()
        self._connected = True

    def _advance(self) -> None:
        now = time.monotonic()
        elapsed = max(0.0, now - self._last_tick)
        self._last_tick = now
        if not self._connected:
            return
        # Nigerian residential baseline ~0.6 kW ± noise.
        kw = max(0.0, 0.6 + random.uniform(-0.4, 0.4))
        self._cumulative_kwh += (kw * elapsed) / 3600.0

    def read_cumulative_kwh(self) -> float:
        self._advance()
        return round(self._cumulative_kwh, 3)

    def read_voltage(self) -> float:
        # NEPA grids sit around 220 V ± sag.
        return round(220.0 + random.uniform(-15.0, 10.0), 1)

    def read_current(self) -> float:
        return round(max(0.0, 2.5 + random.uniform(-2.0, 3.0)), 2)

    def read_power_factor(self) -> float:
        return round(random.uniform(0.88, 0.99), 3)

    def read_status(self) -> str:
        return "connected" if self._connected else "disconnected"

    def disconnect(self) -> None:
        self._connected = False

    def reconnect(self) -> None:
        self._connected = True

    def read_all(self) -> MeterReading:
        return MeterReading(
            cumulative_kwh=self.read_cumulative_kwh(),
            voltage=self.read_voltage(),
            current=self.read_current(),
            power_factor=self.read_power_factor(),
        )
