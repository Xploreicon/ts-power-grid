# OTA firmware updates

The T&S Gateway runs unattended at host sites in Lagos. Pushing fixes
needs to be safe (no bricked Pis), audited (we know what's deployed),
and bandwidth-cheap (some sites are on SIM900A GPRS — see
`firmware/tools/setup_ppp.sh`).

## Flow

```
operator                 release host                  gateway
───────                  ─────────────                 ───────
build.sh ──────────────▶ uploads bundle.tar.gz
                         + manifest.json
                                                       ┌─ daily cron ─┐
                                                       │ ota.check_for_update()
admin pushes "update"                                  │ ota.apply_update()
via MQTT command ──────────────────────────────────▶   │   download bundle
                                                       │   verify sha256
                                                       │   verify Ed25519 sig
                                                       │   extract → staging/
                                                       │   self-test (import smoke)
                                                       │   atomic symlink swap
                                                       │   SIGTERM (systemd restart)
                                                       └─────────────┘
gateway publishes
firmware_update_succeeded ◀────────────────────────────  command_ack
```

The two trigger paths (admin command + daily cron) call the same
`ota.apply_update()` so behaviour is identical regardless of who
initiated.

## Bundle layout

`build.sh` emits, under `firmware/releases/<version>/`:

| File | Purpose |
|---|---|
| `bundle.tar.gz` | gzipped tar of `firmware/ts_gateway/` (no `__pycache__`, no dev-only `data/`). |
| `bundle.tar.gz.sha256` | sha256 hex of the tarball. |
| `bundle.tar.gz.sig` | Ed25519 signature over the sha256 hex (ascii). |
| `manifest.json` | What the gateway fetches from `releases.tspowergrid.com/firmware/latest.json`. |

The signature is over the **sha256 hex string** (ascii bytes), not the
raw tarball. Saves us streaming the bundle through a verifier on a
memory-constrained Pi — the hash is already streamed during the
download, signing the digest is cheap.

## Atomic install

```
/opt/ts-gateway/
  current             → versions/0.1.0          (symlink the systemd unit reads)
  versions/
    0.1.0/            ts_gateway/...            previous release
    0.1.1/            ts_gateway/...            new release (extracted, self-tested)
  staging/            in-flight downloads, cleaned on success
```

`apply_update()` builds the new `versions/<v>` directory, runs the
self-test in a subprocess (so a syntax error in the new code can't
crash the running interpreter), then `os.replace()` swaps `current` to
point at it. POSIX guarantees readers see either the old or the new
target — never a half-state.

## Rollback

Three layers:

1. **Self-test pre-swap.** If `import ts_gateway.<every module>` fails
   in a fresh subprocess, we abort before touching `current`. This
   catches syntax errors, missing deps, broken module-level state.
2. **systemd restart loop.** If the new firmware boots, crashes, and
   keeps crashing, `Restart=always` flaps it forever — visible in the
   admin UI as "online but flapping" via heartbeat gaps. The on-call
   engineer rolls back manually:

   ```bash
   ssh pi@<gateway>
   sudo ln -sfn /opt/ts-gateway/versions/0.1.0 /opt/ts-gateway/current
   sudo systemctl restart ts-gateway
   ```

3. **Server-side pin.** If a release goes wrong fleet-wide, edit
   `latest.json` to point back at the previous bundle. Existing
   gateways won't auto-downgrade (`apply_update` only runs on
   newer versions), so push a `update_firmware` command targeting the
   older bundle's URL — the manifest version comparator won't block it
   when invoked directly.

We deliberately do not auto-rollback after the swap. A working but
buggy release is preferable to flapping between versions while we
debug; the operator decides.

## Signing key management

Generated once, stored on a single operator workstation, never on the
gateway or in CI:

```bash
python3 -c "
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives import serialization
sk = Ed25519PrivateKey.generate()
print(sk.private_bytes(serialization.Encoding.Raw,
                       serialization.PrivateFormat.Raw,
                       serialization.NoEncryption()).hex())
print('PUBKEY:', sk.public_key().public_bytes(
    serialization.Encoding.Raw, serialization.PublicFormat.Raw).hex())
" > firmware/tools/signing_key
chmod 600 firmware/tools/signing_key
```

Paste the `PUBKEY:` line into
`firmware/ts_gateway/ota.py::RELEASE_PUBKEY_HEX`, ship one firmware
build with that pubkey baked in, **then** start signing real releases.
The pubkey is hard-coded on purpose — fetching it over the wire would
defeat signing entirely.

### Rotating the signing key

There is no in-band rotation path. Procedure:

1. Generate a new keypair, paste the new pubkey into `ota.py`.
2. Sign one release with the **old** key that ships the new pubkey —
   this is the last build the fleet will accept under the old key.
3. From the next build onwards, sign with the new key. Gateways that
   missed the transition release stop receiving updates and need a
   manual re-flash.

We accept that brittleness. Compromise of the signing key means
re-flashing every gateway anyway, so optimising for a smooth recovery
is the wrong trade-off.

## Triggering an update manually

```bash
# Push to a single gateway:
mosquitto_pub \
  -h mqtt.tspowergrid.com -p 8883 \
  --cert admin.crt --key admin.key --cafile ca.crt \
  -t "ts/sites/<site_id>/commands" \
  -m '{
    "command_id": "manual-2026-04-25-001",
    "type": "update_firmware",
    "version": "0.2.0",
    "url": "https://releases.tspowergrid.com/firmware/0.2.0/bundle.tar.gz",
    "sha256": "…",
    "signature": "…"
  }'
```

The admin UI's gateway detail page (Update firmware button) wraps the
same call.

## Known gaps

- **No A/B partition.** We swap symlinks inside one filesystem; a
  power loss mid-extract leaves orphaned `staging/` directories that
  `apply_update` cleans on the next attempt. No cross-boot rollback.
- **No bandwidth budgeting.** A 5 MB bundle over GPRS takes ~3 minutes;
  the daily cron should grow a `--max-bandwidth` knob before we ship
  many SIM900A-uplinked sites. Tracked.
- **Self-test is import-only.** It catches static breakage, not
  integration regressions (e.g. a config schema change). Add a 10-second
  smoke run that pings MQTT in dry-run mode before the swap — TODO.
