"""Handles commands received from the cloud.

Each command runs to completion (or explicit rejection) and emits a
`command_ack` event on `ts/sites/{site_id}/events`. Commands are
idempotent: re-running a `disconnect_meter` on an already-open relay
is a no-op that still acks applied.

Firmware updates are deliberately out-of-band: this module records the
request and hands off to a separate updater service (systemd unit)
that runs the download + verification + restart. Keeping the main
service clean of arbitrary-code execution simplifies audit.
"""
from __future__ import annotations

import logging
import os
import signal
import subprocess
import time
from pathlib import Path
from typing import Callable, Optional

log = logging.getLogger(__name__)


def _firmware_update_marker() -> Path:
    """Where `update_firmware` stashes its pending-update marker.

    Prod Pi has `/var/lib/ts-gateway/` writable by the service (see the
    systemd unit's ReadWritePaths). On a dev Mac that directory doesn't
    exist and isn't writable without sudo, so we fall back to a
    package-relative `firmware/data/` path — same convention LocalQueue
    uses."""
    prod = Path("/var/lib/ts-gateway")
    if prod.is_dir() and os.access(prod, os.W_OK):
        return prod / "firmware-update.pending"
    local = Path(__file__).resolve().parent.parent / "data"
    return local / "firmware-update.pending"

# Type of the event publisher the handler uses to ack commands.
PublishEvent = Callable[[dict], bool]


class CommandHandler:
    def __init__(
        self,
        publish_event: PublishEvent,
        meter_reader,
        enable_reboot: bool = False,
    ):
        self._publish = publish_event
        self._reader = meter_reader
        # Real reboots are disabled by default — flip on via config only
        # in prod. Prevents tests/simulator from actually restarting a
        # developer's machine.
        self._enable_reboot = enable_reboot

    # ------------------------------------------------------------------
    # Entry point
    # ------------------------------------------------------------------
    def handle(self, command: dict) -> None:
        command_id = str(command.get("command_id") or "unknown")
        cmd_type = command.get("type")
        handler = _DISPATCH.get(cmd_type or "")
        if handler is None:
            return self._ack(command_id, cmd_type, "rejected", {"reason": "unknown_command"})
        try:
            detail = handler(self, command)
            self._ack(command_id, cmd_type, "applied", detail or {})
        except _CommandRejected as exc:
            self._ack(command_id, cmd_type, "rejected", {"reason": str(exc)})
        except Exception as exc:  # pylint: disable=broad-except
            log.exception("command %s crashed: %s", cmd_type, exc)
            self._ack(command_id, cmd_type, "rejected", {"reason": "exception", "detail": str(exc)})

    # ------------------------------------------------------------------
    # Ack helper
    # ------------------------------------------------------------------
    def _ack(self, command_id: str, cmd_type, status: str, detail: dict) -> None:
        payload = {
            "event": "command_ack",
            "command_id": command_id,
            "command_type": cmd_type,
            "status": status,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            **detail,
        }
        ok = self._publish(payload)
        if not ok:
            log.warning("ack publish failed (offline) for %s", command_id)

    # ------------------------------------------------------------------
    # Individual commands
    # ------------------------------------------------------------------
    def _cmd_disconnect(self, command: dict) -> dict:
        # The dispatch goes through the driver, which decides whether
        # to fire a Modbus relay coil (Hexing) or a GPIO line via
        # RelayController (PZEM-004T). Same call site, different
        # mechanism — that's intentional so adding a third meter
        # vendor doesn't touch this file.
        meter_id = str(command.get("meter_id") or "")
        driver = self._reader.driver_for(meter_id)
        if driver is None:
            raise _CommandRejected("unknown_meter")
        driver.disconnect()
        return {"meter_id": meter_id, "relay": "open"}

    def _cmd_reconnect(self, command: dict) -> dict:
        # See _cmd_disconnect — relay mechanism is driver-dependent.
        meter_id = str(command.get("meter_id") or "")
        driver = self._reader.driver_for(meter_id)
        if driver is None:
            raise _CommandRejected("unknown_meter")
        driver.reconnect()
        return {"meter_id": meter_id, "relay": "closed"}

    def _cmd_reboot(self, _command: dict) -> dict:
        if not self._enable_reboot:
            log.info("reboot requested but disabled by config — ack only")
            return {"simulated": True}
        # systemd's Restart=always in the unit file picks us back up.
        # SIGTERM rather than os.system('reboot') so we only bounce the
        # service, not the whole Pi.
        log.info("rebooting ts-gateway service")
        os.kill(os.getpid(), signal.SIGTERM)
        return {"simulated": False}

    def _cmd_update_firmware(self, command: dict) -> dict:
        version = str(command.get("version") or "")
        url = str(command.get("url") or "")
        sha256 = str(command.get("sha256") or "")
        if not version or not url or not sha256:
            raise _CommandRejected("missing_update_fields")
        # Hand off to the updater helper. It writes a marker file the
        # updater systemd unit watches, so the main service stays clean.
        marker = _firmware_update_marker()
        try:
            marker.parent.mkdir(parents=True, exist_ok=True)
            marker.write_text(f"{version}\n{url}\n{sha256}\n", encoding="utf-8")
        except OSError as exc:
            raise _CommandRejected(f"marker_write_failed: {exc}") from exc
        return {"version": version, "status": "queued", "marker": str(marker)}


class _CommandRejected(Exception):
    """Internal — signals the dispatcher to ack with reason=<message>."""


_DISPATCH: dict[str, Callable[[CommandHandler, dict], Optional[dict]]] = {
    "disconnect_meter": CommandHandler._cmd_disconnect,
    "reconnect_meter": CommandHandler._cmd_reconnect,
    "reboot_gateway": CommandHandler._cmd_reboot,
    "update_firmware": CommandHandler._cmd_update_firmware,
}
