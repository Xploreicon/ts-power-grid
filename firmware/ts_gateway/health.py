"""System health sampling — fed into heartbeat payloads and used to
raise local warning events when the Pi is unwell."""
from __future__ import annotations

import logging
import subprocess
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Optional

try:
    import psutil
except ImportError:  # allow import-time compile checks without the dep
    psutil = None  # type: ignore[assignment]

log = logging.getLogger(__name__)

_BOOT_TIME = time.time()


@dataclass
class HealthSnapshot:
    cpu_temp_c: Optional[float]
    cpu_percent: float
    mem_used_pct: float
    disk_used_pct: float
    free_disk_mb: float
    uptime_sec: int


def _read_cpu_temp() -> Optional[float]:
    """Pi 4 exposes CPU temp via /sys; fall back to vcgencmd on older
    firmwares. Returns None if neither is available (e.g. on macOS dev)."""
    sysfs = Path("/sys/class/thermal/thermal_zone0/temp")
    if sysfs.exists():
        try:
            return int(sysfs.read_text().strip()) / 1000.0
        except (OSError, ValueError):
            return None
    try:
        out = subprocess.check_output(
            ["vcgencmd", "measure_temp"], stderr=subprocess.DEVNULL, timeout=2
        )
        # "temp=54.5'C\n"
        return float(out.decode().strip().split("=")[1].split("'")[0])
    except (FileNotFoundError, subprocess.SubprocessError, ValueError, IndexError):
        return None


def sample() -> HealthSnapshot:
    if psutil is None:
        # Graceful fallback so the service can still report heartbeats.
        return HealthSnapshot(
            cpu_temp_c=_read_cpu_temp(),
            cpu_percent=0.0,
            mem_used_pct=0.0,
            disk_used_pct=0.0,
            free_disk_mb=0.0,
            uptime_sec=int(time.time() - _BOOT_TIME),
        )
    vm = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    return HealthSnapshot(
        cpu_temp_c=_read_cpu_temp(),
        cpu_percent=psutil.cpu_percent(interval=None),
        mem_used_pct=vm.percent,
        disk_used_pct=disk.percent,
        free_disk_mb=round(disk.free / (1024 * 1024), 1),
        uptime_sec=int(time.time() - _BOOT_TIME),
    )


def to_dict(snap: HealthSnapshot) -> dict:
    return asdict(snap)


def check_thresholds(
    snap: HealthSnapshot,
    cpu_temp_c: float,
    disk_used_pct: float,
    mem_used_pct: float,
) -> list[dict]:
    """Return a list of threshold-breach events (empty if all green)."""
    alerts: list[dict] = []
    if snap.cpu_temp_c is not None and snap.cpu_temp_c > cpu_temp_c:
        alerts.append(
            {"kind": "cpu_temp", "value": snap.cpu_temp_c, "threshold": cpu_temp_c}
        )
    if snap.disk_used_pct > disk_used_pct:
        alerts.append(
            {"kind": "disk_full", "value": snap.disk_used_pct, "threshold": disk_used_pct}
        )
    if snap.mem_used_pct > mem_used_pct:
        alerts.append(
            {"kind": "memory_pressure", "value": snap.mem_used_pct, "threshold": mem_used_pct}
        )
    return alerts
