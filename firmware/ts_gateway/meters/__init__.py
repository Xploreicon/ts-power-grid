"""Meter driver registry."""
from __future__ import annotations

from .base import MeterDriver, MeterReading
from .hexing_hxe110 import HexingHXE110
from .simulator import SimulatedMeter

DRIVERS: dict[str, type[MeterDriver]] = {
    "hexing_hxe110": HexingHXE110,
    "simulator": SimulatedMeter,
}


def build_driver(name: str, **kwargs) -> MeterDriver:
    """Instantiate a driver by its config name. Raises KeyError if unknown."""
    cls = DRIVERS[name]
    return cls(**kwargs)


__all__ = ["MeterDriver", "MeterReading", "DRIVERS", "build_driver"]
