"""Abstract meter driver interface.

Each physical meter model gets one subclass. The gateway core never
cares what vendor it's talking to — only that the driver satisfies
this contract.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class MeterReading:
    cumulative_kwh: float
    voltage: float
    current: float
    power_factor: float


class MeterDriver(ABC):
    """Contract every meter driver must implement."""

    @abstractmethod
    def read_cumulative_kwh(self) -> float: ...

    @abstractmethod
    def read_voltage(self) -> float: ...

    @abstractmethod
    def read_current(self) -> float: ...

    @abstractmethod
    def read_power_factor(self) -> float: ...

    @abstractmethod
    def read_status(self) -> str:
        """Return one of: 'connected', 'disconnected', 'fault'."""

    @abstractmethod
    def disconnect(self) -> None:
        """Open the relay. No-op if already disconnected."""

    @abstractmethod
    def reconnect(self) -> None:
        """Close the relay. No-op if already connected."""

    def read_all(self) -> MeterReading:
        """Convenience — full snapshot in one call. Drivers may override
        to batch into a single Modbus transaction."""
        return MeterReading(
            cumulative_kwh=self.read_cumulative_kwh(),
            voltage=self.read_voltage(),
            current=self.read_current(),
            power_factor=self.read_power_factor(),
        )
