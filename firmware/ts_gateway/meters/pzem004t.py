"""PZEM-004T v3.0 driver.

The PZEM-004T is a low-cost AC energy monitor with a TTL/Modbus-RTU
interface. Unlike the Hexing HXE110, the PZEM has no built-in relay —
power cut/reconnect is handled by an external 2-channel relay module
wired to the Pi's GPIO header (see `relay_controller.RelayController`).
The driver therefore owns:

    * Modbus reads for V / I / P / E / f / PF / alarm
    * Delegated relay control via an injected `RelayController` and the
      meter's `relay_pin` (BCM pin number)

Modbus details
--------------
* Function code 0x04 (read input registers). PZEM does **not** expose
  its measurement registers as holding registers; using 0x03 returns
  exception code 0x02 (illegal data address).
* Default slave address 0x01. Configurable via 0x06 write to register
  0x0002, but we don't expose that here — provisioning sets the
  address out-of-band before the meter is bolted into a panel.
* 32-bit values are stored *low word first* (regs[0] = low 16 bits,
  regs[1] = high 16 bits). This is the opposite word order from the
  Hexing driver's float32s, so the helpers don't share code.

Register map (PZEM-004T v3.0 datasheet, rev 1.6)
------------------------------------------------
    0x0000  voltage         uint16  scale 0.1 V
    0x0001  current_lo  } uint32   scale 0.001 A
    0x0002  current_hi  }
    0x0003  power_lo    } uint32   scale 0.1 W
    0x0004  power_hi    }
    0x0005  energy_lo   } uint32   scale 1 Wh   (cumulative)
    0x0006  energy_hi   }
    0x0007  frequency       uint16  scale 0.1 Hz
    0x0008  power_factor    uint16  scale 0.01
    0x0009  alarm_status    uint16  (0xFFFF = over-power alarm tripped)
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from .base import MeterDriver, MeterReading

log = logging.getLogger(__name__)

# Register addresses — addresses match the v3.0 datasheet.
REG_BASE = 0x0000
REG_BLOCK_COUNT = 10  # 0x0000..0x0009 inclusive — one batched read

REG_VOLTAGE = 0x0000
REG_CURRENT = 0x0001        # 2 regs
REG_POWER = 0x0003          # 2 regs
REG_ENERGY = 0x0005         # 2 regs (cumulative Wh)
REG_FREQUENCY = 0x0007
REG_POWER_FACTOR = 0x0008
REG_ALARM = 0x0009

# Sentinel returned by the alarm register when the user-configured
# over-power threshold has tripped. We surface it as `'fault'`.
ALARM_TRIPPED = 0xFFFF


def _u32_lo_hi(regs: list[int], offset: int) -> int:
    """Decode two consecutive 16-bit registers as a uint32 with the low
    word at the lower address — PZEM-004T's word order convention."""
    return regs[offset] | (regs[offset + 1] << 16)


class PZEM004T(MeterDriver):
    """Driver for the PZEM-004T v3.0 AC energy monitor.

    Construction kwargs (all optional except documented):

        client            : pymodbus ModbusSerialClient shared across the bus
        modbus_address    : Modbus slave address, default 1
        relay_controller  : RelayController instance (owns the GPIO pins)
        relay_pin         : BCM pin number this meter's contactor uses

    `disconnect()` / `reconnect()` no-op (with a warning) when the
    relay isn't wired up — useful for dry-run on a dev laptop.
    """

    def __init__(
        self,
        client: Any | None = None,
        modbus_address: int = 1,
        relay_controller: Optional[Any] = None,
        relay_pin: Optional[int] = None,
        **_: Any,
    ):
        self._client = client
        self._addr = modbus_address
        self._relay = relay_controller
        self._relay_pin = relay_pin

    # ------------------------------------------------------------------
    # Modbus reads
    # ------------------------------------------------------------------
    def _read_input(self, register: int, count: int) -> list[int]:
        if self._client is None:
            raise RuntimeError("modbus client not attached")
        rr = self._client.read_input_registers(
            address=register, count=count, slave=self._addr
        )
        if rr.isError():
            raise IOError(
                f"PZEM read failed at 0x{register:04X} (slave={self._addr}): {rr}"
            )
        return rr.registers

    def read_voltage(self) -> float:
        return self._read_input(REG_VOLTAGE, 1)[0] * 0.1

    def read_current(self) -> float:
        return _u32_lo_hi(self._read_input(REG_CURRENT, 2), 0) * 0.001

    def read_power_factor(self) -> float:
        return self._read_input(REG_POWER_FACTOR, 1)[0] * 0.01

    def read_cumulative_kwh(self) -> float:
        # Energy is reported in Wh — convert to kWh to match the
        # gateway's canonical unit.
        return _u32_lo_hi(self._read_input(REG_ENERGY, 2), 0) / 1000.0

    def read_status(self) -> str:
        # 1. Hardware alarm wins — the meter itself flagged a fault.
        try:
            alarm = self._read_input(REG_ALARM, 1)[0]
            if alarm == ALARM_TRIPPED:
                return "fault"
        except IOError:
            return "fault"
        # 2. Otherwise mirror the relay state we last commanded.
        if self._relay is not None and self._relay_pin is not None:
            return self._relay.status(self._relay_pin)
        return "connected"

    # ------------------------------------------------------------------
    # Relay control — delegated to the GPIO controller.
    # ------------------------------------------------------------------
    def disconnect(self) -> None:
        if self._relay is None or self._relay_pin is None:
            log.warning(
                "PZEM disconnect requested but no relay configured (addr=%d)",
                self._addr,
            )
            return
        if not self._relay.disconnect(self._relay_pin):
            raise IOError(f"relay disconnect failed (pin {self._relay_pin})")

    def reconnect(self) -> None:
        if self._relay is None or self._relay_pin is None:
            log.warning(
                "PZEM reconnect requested but no relay configured (addr=%d)",
                self._addr,
            )
            return
        if not self._relay.connect(self._relay_pin):
            raise IOError(f"relay reconnect failed (pin {self._relay_pin})")

    # ------------------------------------------------------------------
    # Batched snapshot — single 10-register read replaces four
    # round-trips on the shared bus.
    # ------------------------------------------------------------------
    def read_all(self) -> MeterReading:
        regs = self._read_input(REG_BASE, REG_BLOCK_COUNT)
        # Offsets within the 10-register block:
        #   [0]    voltage       *0.1 V
        #   [1..2] current u32   *0.001 A
        #   [3..4] power u32     *0.1 W   (unused — derived if needed)
        #   [5..6] energy u32    *1 Wh    -> /1000 -> kWh
        #   [7]    frequency     *0.1 Hz  (unused)
        #   [8]    power_factor  *0.01
        return MeterReading(
            cumulative_kwh=_u32_lo_hi(regs, 5) / 1000.0,
            voltage=regs[0] * 0.1,
            current=_u32_lo_hi(regs, 1) * 0.001,
            power_factor=regs[8] * 0.01,
        )
