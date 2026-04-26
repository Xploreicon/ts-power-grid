"""SQLite offline queue.

When the broker is unreachable, readings pile up here with their original
timestamps. On reconnect, `drain()` yields rows in chronological order so
the backend's (meter_id, timestamp) dedup stays correct even if the same
reading was attempted twice.
"""
from __future__ import annotations

import json
import logging
import os
import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

log = logging.getLogger(__name__)

def default_db_path() -> str:
    """Cross-platform default — `firmware/data/queue.db` relative to this
    package. Production installs override via config (see install.sh
    which points to /var/lib/ts-gateway/queue.db on a Pi)."""
    return str(Path(__file__).resolve().parent.parent / "data" / "queue.db")


_SCHEMA = """
CREATE TABLE IF NOT EXISTS queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meter_id TEXT NOT NULL,
    cumulative_kwh REAL NOT NULL,
    timestamp_utc TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    enqueued_at REAL NOT NULL,
    UNIQUE(meter_id, timestamp_utc)
);
CREATE INDEX IF NOT EXISTS queue_enqueued_idx ON queue (enqueued_at);
"""


class LocalQueue:
    """Single-process, thread-safe SQLite queue.

    Methods mutate a single row at a time and rely on SQLite's own
    WAL-mode locking for durability. Concurrent access from another
    gateway process is not supported and not needed.
    """

    def __init__(self, db_path: str | None, max_age_seconds: int):
        self._db_path = db_path or default_db_path()
        self._max_age_seconds = max_age_seconds
        self._lock = threading.Lock()
        Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.executescript(_SCHEMA)

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self._db_path, timeout=5.0, isolation_level=None)
        try:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA synchronous=NORMAL")
            yield conn
        finally:
            conn.close()

    # ------------------------------------------------------------------
    # Writes
    # ------------------------------------------------------------------
    def enqueue(
        self,
        meter_id: str,
        cumulative_kwh: float,
        timestamp_utc: str,
        payload: dict,
    ) -> None:
        with self._lock, self._connect() as conn:
            try:
                conn.execute(
                    "INSERT INTO queue (meter_id, cumulative_kwh, timestamp_utc, "
                    "payload_json, enqueued_at) VALUES (?, ?, ?, ?, strftime('%s','now'))",
                    (meter_id, cumulative_kwh, timestamp_utc, json.dumps(payload)),
                )
            except sqlite3.IntegrityError:
                # Dedup — same (meter_id, timestamp) already queued. Safe to drop.
                log.debug("queue dedup: %s @ %s", meter_id, timestamp_utc)

    # ------------------------------------------------------------------
    # Drain
    # ------------------------------------------------------------------
    def drain(self, batch: int) -> list[tuple[int, dict]]:
        """Return up to `batch` rows in chronological order. Caller must
        call `ack()` with the ids of rows that successfully published —
        unacked rows stay in the queue for the next attempt.
        """
        with self._lock, self._connect() as conn:
            cur = conn.execute(
                "SELECT id, payload_json FROM queue "
                "ORDER BY timestamp_utc ASC LIMIT ?",
                (batch,),
            )
            return [(row[0], json.loads(row[1])) for row in cur.fetchall()]

    def ack(self, ids: list[int]) -> None:
        if not ids:
            return
        with self._lock, self._connect() as conn:
            qmarks = ",".join("?" for _ in ids)
            conn.execute(f"DELETE FROM queue WHERE id IN ({qmarks})", ids)

    def purge_expired(self) -> int:
        """Drop rows older than max_age. Returns deleted count."""
        with self._lock, self._connect() as conn:
            cur = conn.execute(
                "DELETE FROM queue WHERE enqueued_at < strftime('%s','now') - ?",
                (self._max_age_seconds,),
            )
            return cur.rowcount or 0

    def depth(self) -> int:
        with self._lock, self._connect() as conn:
            cur = conn.execute("SELECT COUNT(*) FROM queue")
            (n,) = cur.fetchone()
            return int(n)
