"""GPIO-driven relay controller.

The PZEM-004T (and any other Modbus-monitor + external-relay meter
combo) cuts and restores AC power through a separate relay module
wired to the Pi's GPIO header — *not* through a Modbus coil register.
This module is a small thread-safe wrapper around `RPi.GPIO` so each
driver can ask for an open/close without touching the GPIO library
directly.

Conventions
-----------
* `channel` is the BCM pin number (e.g. 17, 27). We use BCM mode so
  the numbers in `config.yaml` match the labels on every Pi pinout
  diagram.
* Pin **HIGH = relay closed = power flowing**. The 2-channel relay
  modules we ship with are active-high; if a future build uses an
  active-low module, flip `_HIGH_MEANS_ON` rather than rewriting every
  caller.
* Mock fallback: on a Mac (or any host where `RPi.GPIO` can't import)
  every operation logs and updates internal state but does no real I/O.
  That keeps `--dry-run` and unit tests honest about the call site
  without paying the GPIO ImportError cost.
"""
from __future__ import annotations

import logging
import threading
from typing import Optional

log = logging.getLogger(__name__)

try:
    import RPi.GPIO as GPIO  # type: ignore[import]
    _GPIO_AVAILABLE = True
except (ImportError, RuntimeError):
    # ImportError on Mac / aarch64 dev hosts; RuntimeError on a Pi when
    # the user isn't root and /dev/gpiomem isn't accessible. Either way
    # we degrade to mock mode and let the caller proceed.
    GPIO = None  # type: ignore[assignment]
    _GPIO_AVAILABLE = False
    log.info("RPi.GPIO not available — relay controller running in mock mode")

# Active-high vs active-low — see module docstring.
_HIGH_MEANS_ON = True

_HIGH = 1
_LOW = 0


class RelayController:
    """Owns the BCM pins for the gateway's relay channels.

    One instance per gateway, instantiated by `main.Gateway` and shared
    across all meter drivers that need relay control. Pass the same
    instance into every driver — concurrent disconnect/reconnect calls
    are serialised by the internal lock.
    """

    def __init__(self, pins: Optional[list[int]] = None):
        self._pins: list[int] = []
        self._state: dict[int, int] = {}
        self._lock = threading.Lock()
        self._initialised = False
        if pins:
            self.init(pins)

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    def init(self, pins: list[int]) -> None:
        """Configure the given BCM pins as outputs, initialised HIGH
        (i.e. relays closed, power flowing). Idempotent — calling again
        with a different pin list reconfigures cleanly."""
        with self._lock:
            self._pins = list(pins)
            self._state = {}
            if _GPIO_AVAILABLE:
                GPIO.setmode(GPIO.BCM)
                GPIO.setwarnings(False)
                initial = GPIO.HIGH if _HIGH_MEANS_ON else GPIO.LOW
                for p in self._pins:
                    GPIO.setup(p, GPIO.OUT, initial=initial)
                    self._state[p] = _HIGH
            else:
                for p in self._pins:
                    self._state[p] = _HIGH
            self._initialised = True
            log.info(
                "relay controller initialised on pins %s (mock=%s)",
                self._pins, not _GPIO_AVAILABLE,
            )

    def cleanup(self) -> None:
        """Release the GPIO claim. Called from `Gateway.run()` on
        shutdown so we don't leave the pins half-driven for the next
        process."""
        with self._lock:
            if _GPIO_AVAILABLE and self._initialised and self._pins:
                try:
                    GPIO.cleanup(self._pins)
                except Exception as exc:  # pylint: disable=broad-except
                    log.warning("GPIO cleanup raised: %s", exc)
            self._initialised = False
            self._state.clear()

    # ------------------------------------------------------------------
    # Operations
    # ------------------------------------------------------------------
    def connect(self, channel: int) -> bool:
        """Close the relay on `channel`, restoring power. Returns True
        on success, False if the pin isn't configured or the GPIO write
        raised."""
        return self._set(channel, _HIGH)

    def disconnect(self, channel: int) -> bool:
        """Open the relay on `channel`, cutting power."""
        return self._set(channel, _LOW)

    def status(self, channel: int) -> str:
        """Return `'connected' | 'disconnected' | 'unknown'`. We rely on
        our own state cache rather than reading the pin back — RPi.GPIO
        can read an output but the value is whatever we last wrote, so
        the cache is the truth."""
        with self._lock:
            v = self._state.get(channel)
            if v is None:
                return "unknown"
            return "connected" if v == _HIGH else "disconnected"

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------
    def _set(self, channel: int, value: int) -> bool:
        with self._lock:
            if channel not in self._state:
                log.warning(
                    "relay set on unconfigured pin %s (configured: %s) — ignoring",
                    channel, self._pins,
                )
                return False
            if _GPIO_AVAILABLE:
                try:
                    pin_value = (
                        GPIO.HIGH
                        if (value == _HIGH) == _HIGH_MEANS_ON
                        else GPIO.LOW
                    )
                    GPIO.output(channel, pin_value)
                except Exception as exc:  # pylint: disable=broad-except
                    log.error("GPIO write to pin %s failed: %s", channel, exc)
                    return False
            self._state[channel] = value
            log.info(
                "relay pin %d -> %s",
                channel,
                "HIGH (connected)" if value == _HIGH else "LOW (disconnected)",
            )
            return True
