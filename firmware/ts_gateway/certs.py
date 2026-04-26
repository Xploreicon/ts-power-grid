"""Certificate lifecycle management for the gateway's mTLS identity.

Each gateway authenticates to EMQX with an X.509 client cert whose CN
equals its `site_id`. Certs are issued by the T&S internal CA at
provisioning time and need to be rotated before they expire (default
issuance: 1 year).

Responsibilities of this module:

  * `expiry_status()` — read the active cert and report days-to-expiry.
    The main loop calls this once per heartbeat tick; if the cert is
    within `WARN_DAYS_BEFORE_EXPIRY` we publish a `cert_expiring` event
    so the admin UI can surface it.
  * `rotate()` — handle a `rotate_cert` command. Generates a new key +
    CSR locally, POSTs the CSR to the backend's issuance API, atomically
    swaps the old cert/key for the new pair, and asks the MQTT client to
    reconnect. If anything fails before the swap, the old material is
    untouched and the gateway keeps running.
  * `fingerprint()` — sha256 of the cert DER, hex. Stored backend-side
    so an operator can confirm a freshly-rotated gateway is still itself.

Atomicity: we write `<path>.new`, fsync, then `os.replace` over the live
path. EMQX's broker only learns about the new identity on the next
TCP/TLS handshake, so the reconnect step is the actual cutover.

This module deliberately does NOT touch the CA's private key — issuance
happens server-side. The gateway only ever holds its own client key.
"""
from __future__ import annotations

import json
import logging
import os
import shutil
import ssl
import subprocess
import time
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Optional

log = logging.getLogger(__name__)

WARN_DAYS_BEFORE_EXPIRY = 30
CRITICAL_DAYS_BEFORE_EXPIRY = 7

# Default issuance endpoint — the backend route is implemented in
# `app/api/admin/gateways/[id]/issue-cert/route.ts` (separate task).
DEFAULT_ISSUE_URL = "https://api.tspowergrid.com/v1/gateways/issue-cert"


@dataclass
class CertStatus:
    fingerprint: str
    not_before: datetime
    not_after: datetime
    subject_cn: str
    days_until_expiry: int

    @property
    def needs_warning(self) -> bool:
        return self.days_until_expiry <= WARN_DAYS_BEFORE_EXPIRY

    @property
    def is_critical(self) -> bool:
        return self.days_until_expiry <= CRITICAL_DAYS_BEFORE_EXPIRY


class CertError(RuntimeError):
    """Raised by rotate() — caller publishes a `cert_rotation_failed` event."""


# ---------------------------------------------------------------------------
# Reading the live cert
# ---------------------------------------------------------------------------
def expiry_status(cert_path: Path | str) -> CertStatus:
    """Parse the PEM cert at `cert_path` and report its lifetime.

    Pure-stdlib (`ssl._ssl._test_decode_cert` is private; we shell out to
    `openssl x509` for portability — the binary is always present on a
    Pi running EMQX-bound mTLS, and on dev machines we accept the
    runtime cost of one fork)."""
    cert_path = Path(cert_path)
    if not cert_path.is_file():
        raise CertError(f"cert_not_found: {cert_path}")

    not_before = _x509_field(cert_path, "-startdate")
    not_after = _x509_field(cert_path, "-enddate")
    subject = _x509_field(cert_path, "-subject")
    fp = fingerprint(cert_path)

    nb = _parse_openssl_date(not_before)
    na = _parse_openssl_date(not_after)
    days_left = (na - datetime.now(timezone.utc)).days
    cn = _extract_cn(subject)

    return CertStatus(
        fingerprint=fp,
        not_before=nb,
        not_after=na,
        subject_cn=cn,
        days_until_expiry=days_left,
    )


def fingerprint(cert_path: Path | str) -> str:
    """sha256 of the cert DER, hex with colons stripped."""
    out = subprocess.check_output(
        ["openssl", "x509", "-in", str(cert_path), "-noout", "-fingerprint", "-sha256"],
        text=True,
    )
    # "sha256 Fingerprint=AA:BB:..."
    _, _, hexpart = out.strip().partition("=")
    return hexpart.replace(":", "").lower()


# ---------------------------------------------------------------------------
# Rotation
# ---------------------------------------------------------------------------
def rotate(
    cert_path: Path | str,
    key_path: Path | str,
    site_id: str,
    issue_url: str = DEFAULT_ISSUE_URL,
    auth_token: Optional[str] = None,
    on_swap: Optional[Callable[[CertStatus], None]] = None,
) -> CertStatus:
    """Generate a new keypair + CSR, exchange it for a signed cert, swap.

    `auth_token` is the gateway's bearer token — it's a separate secret
    from the cert (set during provisioning) so an attacker holding only
    the soon-to-expire cert can't request a fresh one. The backend
    binds issuance to the same `site_id` the auth token belongs to.

    `on_swap` fires after the swap succeeds and before the function
    returns; the gateway uses it to trigger an MQTT reconnect.
    """
    cert_path = Path(cert_path)
    key_path = Path(key_path)
    backup_dir = cert_path.parent / "backup" / time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())

    # 1. Generate a fresh keypair + CSR in a temp dir.
    workdir = cert_path.parent / ".rotate"
    workdir.mkdir(parents=True, exist_ok=True)
    new_key = workdir / "client.new.key"
    new_csr = workdir / "client.new.csr"
    log.info("generating new key + csr (CN=%s)", site_id)
    _run([
        "openssl", "req", "-new", "-newkey", "ec",
        "-pkeyopt", "ec_paramgen_curve:P-256",
        "-nodes", "-keyout", str(new_key), "-out", str(new_csr),
        "-subj", f"/CN={site_id}",
    ])

    # 2. Submit CSR to backend, expect a signed cert back.
    csr_pem = new_csr.read_text(encoding="utf-8")
    body = json.dumps({"site_id": site_id, "csr": csr_pem}).encode("utf-8")
    req = urllib.request.Request(
        issue_url,
        data=body,
        method="POST",
        headers={"content-type": "application/json"},
    )
    if auth_token:
        req.add_header("authorization", f"Bearer {auth_token}")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except (OSError, ValueError) as exc:
        raise CertError(f"issue_request_failed: {exc}") from exc

    new_cert_pem = payload.get("cert")
    if not new_cert_pem:
        raise CertError("issue_response_missing_cert")
    new_cert = workdir / "client.new.crt"
    new_cert.write_text(new_cert_pem, encoding="utf-8")

    # Sanity: cert public key must match the key we just generated.
    if not _cert_matches_key(new_cert, new_key):
        raise CertError("issued_cert_does_not_match_key")

    # 3. Backup current pair and atomically swap.
    backup_dir.mkdir(parents=True, exist_ok=True)
    if cert_path.exists():
        shutil.copy2(cert_path, backup_dir / cert_path.name)
    if key_path.exists():
        shutil.copy2(key_path, backup_dir / key_path.name)
    log.info("backed up old material to %s", backup_dir)

    _atomic_replace(new_cert, cert_path)
    _atomic_replace(new_key, key_path, mode=0o600)
    log.info("rotated cert/key in place")

    status = expiry_status(cert_path)
    if on_swap is not None:
        try:
            on_swap(status)
        except Exception as exc:  # pylint: disable=broad-except
            # Swap already happened — log but don't claim failure.
            log.warning("on_swap callback raised: %s", exc)
    return status


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _x509_field(cert_path: Path, flag: str) -> str:
    out = subprocess.check_output(
        ["openssl", "x509", "-in", str(cert_path), "-noout", flag],
        text=True,
    )
    return out.strip()


def _parse_openssl_date(line: str) -> datetime:
    # `-startdate` / `-enddate` -> "notBefore=Apr 25 12:00:00 2026 GMT"
    _, _, value = line.partition("=")
    dt = datetime.strptime(value.strip(), "%b %d %H:%M:%S %Y %Z")
    return dt.replace(tzinfo=timezone.utc)


def _extract_cn(subject: str) -> str:
    # `-subject` -> "subject=CN = 0000-...-0000" or older "subject= /CN=..."
    for sep in (", ", "/"):
        for part in subject.split(sep):
            part = part.strip()
            if part.upper().startswith("CN"):
                _, _, cn = part.partition("=")
                return cn.strip()
    return ""


def _cert_matches_key(cert: Path, key: Path) -> bool:
    """Confirm cert.pubkey == derive(key) — guards against the backend
    accidentally signing somebody else's CSR."""
    cert_pub = subprocess.check_output(
        ["openssl", "x509", "-in", str(cert), "-noout", "-pubkey"],
        text=True,
    )
    key_pub = subprocess.check_output(
        ["openssl", "pkey", "-in", str(key), "-pubout"],
        text=True,
    )
    return cert_pub.strip() == key_pub.strip()


def _atomic_replace(src: Path, dst: Path, mode: int = 0o644) -> None:
    """Move src -> dst with fsync, replacing any existing dst atomically."""
    os.chmod(src, mode)
    tmp = dst.with_suffix(dst.suffix + ".new")
    shutil.copy2(src, tmp)
    fd = os.open(tmp, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)
    os.replace(tmp, dst)


def _run(cmd: list[str]) -> None:
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise CertError(
            f"command_failed cmd={cmd[0]} rc={proc.returncode} "
            f"stderr={proc.stderr.strip()[:300]}"
        )
