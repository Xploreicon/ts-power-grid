"""Hexing HXE110-KP smart meter driver.

Register map (per HXE110-KP Modbus manual, rev 2.1):
    0x0000  cumulative_kwh     float32 (big-endian, 2 regs)
    0x0002  reserved
    0x0004  reserved
    0x0006  voltage            float32 (V)
    0x0008  current            float32 (A)
    0x000A  active_power       float32 (W)
    0x000C  power_factor       float32 (unitless, 0.0–1.0)
    0x0020  relay_status       uint16  (0=open, 1=closed)
    0x0100  relay_control      uint16  (write 0=open, 1=close)
    0x0200  fault_flags        uint16  bitfield

Uses Modbus function 0x03 (read holding registers) for reads and 0x06
(write single register) to control the relay.
"""
from __future__ import annotations

import struct
from typing import Any

from .base import MeterDriver, MeterReading

# Register addresses.
REG_CUMULATIVE_KWH = 0x0000
REG_VOLTAGE = 0x0006
REG_CURRENT = 0x0008
REG_POWER_FACTOR = 0x000C
REG_RELAY_STATUS = 0x0020
REG_RELAY_CONTROL = 0x0100
REG_FAULT_FLAGS = 0x0200


def _decode_float32(regs: list[int]) -> float:
    """Decode two big-endian 16-bit registers into a float32."""
    if len(regs) != 2:
        raise ValueError(f"expected 2 registers, got {len(regs)}")
    packed = struct.pack(">HH", regs[0], regs[1])
    return struct.unpack(">f", packed)[0]


class HexingHXE110(MeterDriver):
    """Driver for the Hexing HXE110-KP prepaid meter.

    `client` is a pymodbus ModbusSerialClient instance shared across all
    meters on the bus. `address` is the Modbus slave address (1–247).
    """

    def __init__(self, client: Any | None = None, modbus_address: int = 1, **_: Any):
        self._client = client
        self._addr = modbus_address

    # ------------------------------------------------------------------
    # Reads
    # ------------------------------------------------------------------
    def _read_float(self, register: int) -> float:
        if self._client is None:
            raise RuntimeError("modbus client not attached")
        rr = self._client.read_holding_registers(
            address=register, count=2, slave=self._addr
        )
        if rr.isError():
            raise IOError(f"modbus read failed at 0x{register:04X}: {rr}")
        return _decode_float32(rr.registers)

    def read_cumulative_kwh(self) -> float:
        return self._read_float(REG_CUMULATIVE_KWH)

    def read_voltage(self) -> float:
        return self._read_float(REG_VOLTAGE)

    def read_current(self) -> float:
        return self._read_float(REG_CURRENT)

    def read_power_factor(self) -> float:
        return self._read_float(REG_POWER_FACTOR)

    def read_status(self) -> str:
        if self._client is None:
            raise RuntimeError("modbus client not attached")
        fault = self._client.read_holding_registers(
            address=REG_FAULT_FLAGS, count=1, slave=self._addr
        )
        if not fault.isError() and fault.registers[0] != 0:
            return "fault"
        rr = self._client.read_holding_registers(
            address=REG_RELAY_STATUS, count=1, slave=self._addr
        )
        if rr.isError():
            raise IOError(f"relay status read failed: {rr}")
        return "connected" if rr.registers[0] == 1 else "disconnected"

    # ------------------------------------------------------------------
    # Relay control
    # ------------------------------------------------------------------
    def disconnect(self) -> None:
        self._write_relay(0)

    def reconnect(self) -> None:
        self._write_relay(1)

    def _write_relay(self, value: int) -> None:
        if self._client is None:
            raise RuntimeError("modbus client not attached")
        rr = self._client.write_register(
            address=REG_RELAY_CONTROL, value=value, slave=self._addr
        )
        if rr.isError():
            raise IOError(f"relay write failed: {rr}")

    # ------------------------------------------------------------------
    # Batched snapshot — single 14-register read is much faster than
    # four separate reads on a shared RS-485 bus.
    # ------------------------------------------------------------------
    def read_all(self) -> MeterReading:
        if self._client is None:
            raise RuntimeError("modbus client not attached")
        rr = self._client.read_holding_registers(
            address=REG_CUMULATIVE_KWH, count=14, slave=self._addr
        )
        if rr.isError():
            raise IOError(f"batch read failed: {rr}")
        regs = rr.registers
        return MeterReading(
            cumulative_kwh=_decode_float32(regs[0:2]),
            voltage=_decode_float32(regs[6:8]),
            current=_decode_float32(regs[8:10]),
            power_factor=_decode_float32(regs[12:14]),
        )
