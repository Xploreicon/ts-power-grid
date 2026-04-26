# Security model — gateway fleet

Scope: the cryptographic identity, key custody, and revocation
procedures for the T&S Gateway Hubs deployed at host sites. For app /
backend auth see `lib/auth/` and the project root `CLAUDE.md`.

## Identities

| Principal | Identity | Where the secret lives |
|---|---|---|
| Gateway → broker | X.509 client cert, CN = `site_id`, EC P-256 | `/etc/ts-gateway/certs/client.{crt,key}` on the Pi |
| Broker → gateway | X.509 server cert from internal CA | EMQX container, mounted via `infra/mqtt/docker-compose.yml` |
| Release pipeline → fleet | Ed25519 signing key | One operator workstation, `firmware/tools/signing_key` |
| Operator → CA | Filesystem access to `infra/mqtt/certs/ca.key` | One operator workstation, never copied |
| Admin → backend | Email + password (Supabase) + role check | Supabase, see `CLAUDE.md` auth section |

The gateway never holds the CA private key, the release signing key,
or any other gateway's cert. A compromise of one gateway compromises
exactly one site.

## Certificate lifecycle

```
provision.sh ──▶ client cert + key ──▶ ship to Pi
                                        │
                                        ▼
                                  daily heartbeat
                                  certs.expiry_status()
                                        │
                              days_until_expiry ≤ 30?
                                        │
                                        ▼
                              cert_expiring event ──▶ admin UI alert
                                        │
                              admin clicks "Rotate"
                                        │
                                        ▼
                     rotate_cert command via MQTT
                                        │
                                        ▼
                         certs.rotate()
                           ├─ openssl req -new (P-256)
                           ├─ POST /v1/gateways/issue-cert
                           ├─ verify cert.pubkey == derive(key)
                           ├─ atomic swap (os.replace)
                           └─ MQTT reconnect with new identity
```

Default issuance is 1 year. Warning starts at 30 days; critical at 7
days (heartbeat severity bumps). Rotation is idempotent — re-running
on a cert that doesn't need it just produces a fresh 1-year cert.

### Atomicity

`certs._atomic_replace` writes to `<path>.new`, fsyncs, then
`os.replace`s over the live path. EMQX only learns about the new
identity on the next TCP/TLS handshake, so the actual cutover is
the MQTT reconnect — until then the gateway holds two valid certs on
disk and EMQX still trusts the old one.

If issuance succeeds but the swap fails (disk full, permission flip),
old material is untouched and the gateway keeps running. Backup of the
prior pair lives in `<certs>/backup/<timestamp>/`.

## Revocation

Triggered when:

- A gateway is decommissioned (host disconnected, fraud, hardware
  retired).
- A gateway is suspected compromised (key exfiltration, lost SD card).
- An operator revokes a stale cert that didn't rotate cleanly.

Procedure (`infra/mqtt/revocation.py`):

```bash
cd infra/mqtt
python revocation.py revoke \
    --serial 0xAB12CD... \
    --reason key_compromise \
    --reviewer eng@tspowergrid.com
```

What happens:

1. `openssl ca -revoke` appends to `infra/mqtt/ca_db/index.txt`.
2. `openssl ca -gencrl` rebuilds `infra/mqtt/certs/crl.pem`.
3. EMQX is restarted (docker-compose) or `listeners reload`'d (SSH)
   so the broker re-reads the CRL.
4. The script POSTs to the backend admin audit endpoint —
   `lib/audit` records who revoked which serial, when, and why. The
   record is immutable from the admin UI.

EMQX checks the CRL on every TLS handshake, not on existing
connections. Revoked gateways stay connected until their TCP socket
drops (network blip, broker restart, keepalive timeout — at most 60s
with our default keepalive). To kick a connected revoked gateway
immediately, restart EMQX or use the EMQX admin API to drop the
client session.

## Threat model

What we defend against:

| Threat | Mitigation |
|---|---|
| Adversary on the network reads telemetry | TLS 1.2+ on the broker leg, mTLS pins both sides |
| Adversary spoofs a gateway | Broker ACL keyed on cert CN; `acl.conf` denies cross-site topic access |
| Adversary steals a Pi from a host site | Rotate that site's cert, revoke the old serial; SD card encryption is *not* assumed (see gaps below) |
| Adversary ships a malicious firmware update | All bundles signed Ed25519; pubkey hard-coded in `ota.py`; signing key never on a network-reachable machine |
| Adversary tampers with a deployed firmware on disk | Out of scope — once you have root on the Pi, nothing helps. We don't claim verified boot |
| Adversary intercepts a manifest | Fetch is over HTTPS, but the signature on the bundle digest is the real protection — manifest URL trust is not load-bearing |
| Adversary replays a recorded telemetry stream | Topic ACL is per-site; replay on a different site fails. Same-site replay produces dedup hits in `processReading` (idempotent on `(meter_id, timestamp)`) |
| Adversary brute-forces the OTP flow | `/api/auth/send-otp` rate-limits 3/15min; `verify_otp_challenge()` consumes the row on any attempt; see `lib/auth/otp.ts` |

What we do **not** defend against, and why:

- **Physical tamper on the Pi.** No TPM, no secure boot. A determined
  attacker with the SD card can read the client key and pose as that
  gateway. Mitigation is operational: revoke quickly. We accept this
  trade because TPM-backed Pis don't exist at our price point, and the
  blast radius is one site.
- **Compromise of the operator workstation.** It holds the CA key and
  the signing key. There's no recovery path here — both keys would
  need rotation, every gateway re-flashed, every admin re-issued.
  Mitigation: keep the workstation off the corporate network, hardware
  full-disk encryption, single human custodian.
- **Side-channel leakage of the client key.** The Pi runs other OS
  services; an attacker with code-execution-but-not-root could read
  `/etc/ts-gateway/certs/client.key` if the file mode drifts. Audited
  by the install script (`chmod 600`); not enforced at runtime.
- **Long-lived sessions after revocation.** EMQX checks CRL only at
  handshake. We accept up to one keepalive interval (60s) of post-
  revocation access.

## Key rotation overview

| Key | Cadence | How |
|---|---|---|
| Gateway client cert | Yearly + on rotate command | `certs.rotate()` |
| Broker server cert | Yearly | Reissue from internal CA, restart EMQX |
| Internal CA | 5-year root, never online | Manual reissue, every gateway re-provisioned (rare event) |
| Release signing key | On compromise only | Manual re-flash of every gateway (see `docs/ota.md`) |
| Operator admin password | Per Supabase policy | App auth, not gateway scope |

## Audit trail

Every cert-touching action lands in the backend audit log:

- Cert issuance (`provision.sh` → POST during enrolment, when the
  pairing token is consumed).
- Cert rotation (`certs.rotate` → backend records old + new
  fingerprint).
- Cert revocation (`revocation.py` → POST to `TS_AUDIT_URL`).
- Firmware updates (`ota.apply_update` publishes
  `firmware_update_succeeded` / `_failed` events; admin command panel
  records the trigger).

Operators can reconstruct "what was deployed where, signed by whom,
and when" from the audit table and the immutable `versions/`
directories on each Pi.
