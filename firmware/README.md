# T&S Gateway Hub Firmware

Python 3.11+ service that runs on a Raspberry Pi 4 at every T&S host
site. It polls the bi-directional meter(s) over Modbus RTU (RS-485),
publishes telemetry and heartbeats to the cloud MQTT broker, and
executes remote commands (disconnect/reconnect/reboot/OTA).

## Layout

```
firmware/
  ts_gateway/
    main.py              entry point
    config.py / config.yaml   YAML loader + default config
    mqtt_client.py       paho-mqtt wrapper, mTLS, topic conventions
    command_handler.py   dispatch + ack for incoming commands
    meter_reader.py      periodic Modbus polling loop
    meters/
      base.py            abstract MeterDriver
      hexing_hxe110.py   Hexing HXE110-KP driver
      simulator.py       in-memory fake meter
    local_db.py          SQLite offline queue
    health.py            CPU / memory / disk / temp sampling
    install.sh           Pi install + systemd enable
    ts-gateway.service   systemd unit
    requirements.txt     runtime deps
```

## Install on a Pi

```bash
git clone https://github.com/your-org/ts-power-grid
cd ts-power-grid/firmware/ts_gateway
sudo bash install.sh
# edit /etc/ts-gateway/config.yaml — set site_id, meter UUIDs, certs
sudo systemctl start ts-gateway
journalctl -u ts-gateway -f
```

The installer lays out:

| Path | Contents |
|---|---|
| `/opt/ts-gateway/` | source + virtualenv |
| `/etc/ts-gateway/config.yaml` | editable config (chmod 640) |
| `/etc/ts-gateway/certs/` | mTLS material (chmod 600) |
| `/var/lib/ts-gateway/queue.db` | offline queue |
| `/var/log/ts-gateway/` | optional file logging; journald is primary |

## Run locally (dev)

The service runs as a Python package, so from the repo root:

```bash
cd firmware
python3 -m venv .venv && source .venv/bin/activate
pip install -r ts_gateway/requirements.txt

# --dry-run keeps reads flowing but skips MQTT publish
python3 -m ts_gateway.main --config ts_gateway/config.yaml --dry-run
```

For a fully-simulated run (no Modbus, no cloud), set the meter driver
to `simulator` in the config:

```yaml
meters:
  - id: "00000000-0000-0000-0000-000000000001"
    driver: "simulator"
    modbus_address: 0
    role: "host"
```

## Configuration reference

Full example in `ts_gateway/config.yaml`. Key knobs:

| Key | Meaning |
|---|---|
| `site_id` | UUID matching the CN of the mTLS cert. Broker ACL enforces. |
| `mqtt.host` / `mqtt.port` | Broker endpoint. Port 8883 for mTLS. |
| `mqtt.ca_cert` / `mqtt.client_cert` / `mqtt.client_key` | TLS material. |
| `intervals.meter_poll_sec` | Telemetry cadence (default 30 s). |
| `intervals.heartbeat_sec` | Heartbeat cadence (default 300 s). |
| `offline_queue.max_age_hours` | Stale queue rows are dropped (default 72 h). |
| `thresholds.cpu_temp_c` | Emits `health_breach` event above this (default 80°C). |
| `meters[].driver` | `hexing_hxe110` for real meters, `simulator` for dev. |

## Offline behaviour

When the broker is unreachable:

1. Meter reads continue on schedule.
2. Each reading is stored in `queue.db` with its original UTC timestamp.
3. On reconnect, `_drain_queue()` publishes in chronological order.
4. The backend dedups on `(meter_id, timestamp)` so replays are safe.
5. Rows older than `offline_queue.max_age_hours` are purged — they're
   stale enough that billing for them would be dishonest.

Disconnect/reconnect relay commands continue to work locally even
with no cloud connectivity (they're applied directly via Modbus),
but without the cloud round-trip the admin UI won't know.

## Command flow

```
cloud ── publish ts/sites/{site_id}/commands ──▶ gateway
                                                 │
                                          command_handler
                                                 │
                                           executes + acks
                                                 │
gateway ── publish ts/sites/{site_id}/events ──▶ cloud
```

Supported command types:

| `type` | Effect |
|---|---|
| `disconnect_meter` | Opens the meter relay. Idempotent. |
| `reconnect_meter` | Closes the relay. Idempotent. |
| `reboot_gateway` | Restarts the `ts-gateway` service (disabled by default — set `enable_reboot=True` in `main.py` for prod). |
| `update_firmware` | Writes a marker file to `/var/lib/ts-gateway/firmware-update.pending`; a separate updater unit does the download + swap. |

Every command triggers a `command_ack` event with `status=applied`
or `status=rejected` and a reason.

## Troubleshooting

**"modbus read failed"**

- Check `ls /dev/ttyUSB*`. The RS-485 adapter must be present.
- `modbus.port` in config matches the real device.
- Meter's `modbus_address` matches the jumper/DIP on the meter.
- Try `sudo dmesg | tail` after plugging the adapter to confirm the kernel saw it.

**"mqtt connect failed"**

- `mqtt.host` resolves: `getent hosts mqtt.tspowergrid.com`.
- Certs exist and match the broker's CA.
- `site_id` in config equals the CN of `client.crt`:
  `openssl x509 -in /etc/ts-gateway/certs/client.crt -subject -noout`
- Broker allows the source IP (firewall / ACL).

**Queue growing without draining**

- Service logs `[mqtt disconnected]` repeatedly → broker side.
- `sqlite3 /var/lib/ts-gateway/queue.db "SELECT COUNT(*) FROM queue"`
- Once reconnected, drain runs every main-loop tick (5 s) in batches
  of `offline_queue.drain_batch` (default 100).

**CPU temp alerts on the Pi**

- Usually inadequate airflow — add a heatsink + fan.
- Confirm: `cat /sys/class/thermal/thermal_zone0/temp` (millicelsius).

## Version

See `ts_gateway/__init__.py::__version__`. Bump per release;
included in every heartbeat payload so the admin fleet view shows
the deployed version.
