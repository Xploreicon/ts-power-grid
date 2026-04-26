"""Revoke a gateway client cert and push the updated CRL to EMQX.

Usage
-----
    python infra/mqtt/revocation.py revoke \\
        --serial 0xAB12CD... \\
        --reason key_compromise \\
        --reviewer admin@tspowergrid.com

    python infra/mqtt/revocation.py list
    python infra/mqtt/revocation.py rebuild-crl

What it does
------------
1. Loads the CA private key + cert from `infra/mqtt/certs/ca.{crt,key}`.
   These are operator-provisioned and are not part of the repo (the
   `.gitignore` excludes them).
2. Appends `<serial>,<revocation_time>,<reason>` to the OpenSSL "index"
   database at `infra/mqtt/ca_db/index.txt`. OpenSSL uses this file as
   its source of truth when building a CRL.
3. Calls `openssl ca -gencrl` to (re)build `infra/mqtt/certs/crl.pem`.
4. Reloads EMQX so it picks up the new CRL — by default this means
   restarting the docker-compose service. The EMQX listener is already
   configured (`infra/mqtt/docker-compose.yml`) to read the mounted CRL
   file at startup.
5. Logs to the backend admin audit trail via the
   `/api/admin/audit/cert-revocation` endpoint so the action shows up
   in the UI alongside other admin actions.

Threat model: this script must be run from an operator workstation that
holds the CA key. We deliberately do NOT expose CA-key access to the
gateway, the backend service, or anyone except the on-call engineer who
is running the revocation. See docs/security.md.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path
from typing import Optional


HERE = Path(__file__).resolve().parent
CA_DIR = HERE / "certs"
DB_DIR = HERE / "ca_db"
INDEX_FILE = DB_DIR / "index.txt"
CRL_FILE = CA_DIR / "crl.pem"
OPENSSL_CONF = DB_DIR / "openssl.cnf"

# Revocation reasons accepted by openssl ca -revoke (subset).
VALID_REASONS = {
    "unspecified",
    "key_compromise",
    "ca_compromise",
    "affiliation_changed",
    "superseded",
    "cessation_of_operation",
    "certificate_hold",
}


def _ensure_db() -> None:
    """First-run bootstrap of the OpenSSL index/CRL state."""
    DB_DIR.mkdir(parents=True, exist_ok=True)
    if not INDEX_FILE.exists():
        INDEX_FILE.write_text("")
    serial = DB_DIR / "serial"
    if not serial.exists():
        serial.write_text("1000\n")
    crlnum = DB_DIR / "crlnumber"
    if not crlnum.exists():
        crlnum.write_text("1000\n")
    if not OPENSSL_CONF.exists():
        OPENSSL_CONF.write_text(_default_openssl_conf())


def _default_openssl_conf() -> str:
    """Minimal CA configuration so `openssl ca -revoke` and `-gencrl`
    work without prompting. Paths are interpolated relative to this
    file at write time."""
    return f"""[ ca ]
default_ca = ts_ca

[ ts_ca ]
dir               = {DB_DIR}
database          = {INDEX_FILE}
serial            = {DB_DIR}/serial
crlnumber         = {DB_DIR}/crlnumber
new_certs_dir     = {DB_DIR}
certificate       = {CA_DIR}/ca.crt
private_key       = {CA_DIR}/ca.key
default_md        = sha256
default_crl_days  = 7
policy            = ts_policy

[ ts_policy ]
commonName = supplied
"""


def revoke(serial: str, reason: str, reviewer: str, audit_url: Optional[str]) -> None:
    if reason not in VALID_REASONS:
        raise SystemExit(f"invalid reason — choose from {sorted(VALID_REASONS)}")

    _ensure_db()
    cert_for_serial = CA_DIR / f"issued/{serial}.crt"
    if not cert_for_serial.is_file():
        # The script can revoke by serial alone if the issued copy is
        # missing — operators sometimes only have the serial from the
        # admin UI. Fall back to a synthetic cert path using the index.
        raise SystemExit(
            f"issued cert not found at {cert_for_serial}. "
            "Either restore from backup or use --by-serial-only (TODO)."
        )

    print(f"==> revoking {serial} (reason={reason}, reviewer={reviewer})")
    subprocess.run(
        [
            "openssl", "ca",
            "-config", str(OPENSSL_CONF),
            "-revoke", str(cert_for_serial),
            "-crl_reason", reason,
        ],
        check=True,
    )

    rebuild_crl()
    reload_emqx()

    if audit_url:
        _audit(audit_url, serial=serial, reason=reason, reviewer=reviewer)
    else:
        print("    skipping audit POST — set $TS_AUDIT_URL to enable")


def rebuild_crl() -> None:
    _ensure_db()
    print(f"==> regenerating CRL at {CRL_FILE}")
    subprocess.run(
        [
            "openssl", "ca",
            "-config", str(OPENSSL_CONF),
            "-gencrl",
            "-out", str(CRL_FILE),
        ],
        check=True,
    )


def reload_emqx() -> None:
    """Tell the running EMQX broker to re-read its CRL.

    Two paths supported: a docker-compose deployment (the default) and
    a remote SSH reload (`TS_EMQX_SSH=user@host`). Either way EMQX 5.x
    picks up the new file the next time the listener accepts a TLS
    handshake — the call is essentially a SIGHUP."""
    ssh_target = os.environ.get("TS_EMQX_SSH")
    if ssh_target:
        print(f"==> ssh {ssh_target} 'emqx ctl listeners reload'")
        subprocess.run(
            ["ssh", ssh_target, "emqx ctl listeners reload"], check=True
        )
        return

    compose = HERE / "docker-compose.yml"
    if compose.is_file():
        print("==> docker compose: restarting emqx so CRL reloads")
        subprocess.run(
            ["docker", "compose", "-f", str(compose), "restart", "emqx"],
            check=True,
        )
        return

    print("    WARNING: no EMQX reload target found — restart the broker manually")


def list_revoked() -> None:
    _ensure_db()
    if not INDEX_FILE.read_text().strip():
        print("(no revocations yet)")
        return
    print(f"{'STATUS':<6} {'EXPIRES':<16} {'REVOKED':<24} {'SERIAL':<20}")
    for line in INDEX_FILE.read_text().splitlines():
        cols = line.split("\t")
        if len(cols) < 6:
            continue
        status, expires, revoked, serial, _filename, subject = cols[:6]
        if status != "R":
            continue
        print(f"{status:<6} {expires:<16} {revoked:<24} {serial:<20} {subject}")


def _audit(url: str, **fields) -> None:
    body = json.dumps({
        "action": "cert_revocation",
        "timestamp": dt.datetime.now(dt.timezone.utc).isoformat(),
        **fields,
    }).encode("utf-8")
    req = urllib.request.Request(
        url, data=body, method="POST",
        headers={"content-type": "application/json"},
    )
    token = os.environ.get("TS_ADMIN_TOKEN")
    if token:
        req.add_header("authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            print(f"    audit logged ({resp.status})")
    except OSError as exc:
        print(f"    audit POST failed: {exc} — revocation still applied locally")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n", 1)[0])
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_revoke = sub.add_parser("revoke", help="Revoke a single cert by serial")
    p_revoke.add_argument("--serial", required=True)
    p_revoke.add_argument("--reason", default="unspecified", choices=sorted(VALID_REASONS))
    p_revoke.add_argument("--reviewer", required=True, help="email or username for audit log")
    p_revoke.add_argument(
        "--audit-url",
        default=os.environ.get("TS_AUDIT_URL"),
        help="Backend admin audit endpoint (env TS_AUDIT_URL)",
    )

    sub.add_parser("list", help="Show all revoked certs")
    sub.add_parser("rebuild-crl", help="Regenerate CRL without revoking anything new")

    args = parser.parse_args()
    if args.cmd == "revoke":
        revoke(args.serial, args.reason, args.reviewer, args.audit_url)
    elif args.cmd == "list":
        list_revoked()
    elif args.cmd == "rebuild-crl":
        rebuild_crl()
        reload_emqx()
    return 0


if __name__ == "__main__":
    sys.exit(main())
