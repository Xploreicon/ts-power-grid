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
| `meters[].driver` | `pzem004t` (default), `hexing_hxe110` (legacy retrofits), `simulator` (dev). |
| `meters[].modbus_address` | Slave address — PZEM ships at `1`; flash a different address before bolting two PZEMs onto one bus. |
| `meters[].relay_pin` | BCM pin driving this meter's contactor (PZEM only — Hexing has its own relay). Must reference one of `relay_pins`. |
| `relay_pins` | Top-level list of BCM pins reserved for the relay module. Empty list = no relay hardware. |

## PZEM-004T setup

The PZEM-004T v3.0 is what we ship in 2026 — a low-cost AC monitor over
Modbus RTU paired with a 2-channel SRD relay module wired to the Pi's
GPIO header. Wiring per host site:

```
mains live ──┬─────────────── PZEM L_in
             │
             └── relay COM ── PZEM L_out → load
                relay NO  ─── (cut path)
                relay coil ── GPIO17 (ch1)  /  GPIO27 (ch2)

PZEM TX  ── USB-TTL adapter RX (CH340/FTDI)  → /dev/ttyUSB0
PZEM RX  ── USB-TTL adapter TX
PZEM 5V  ── adapter 5V
PZEM GND ── adapter GND, common with Pi GND
```

Notes:

- **Slave addresses.** Out of the box every PZEM answers on `0x01`. If
  you wire two onto one RS-485 segment, change the second one's
  address with the `0x06` write to register `0x0002` *before* daisy-
  chaining — the official PZEM tool or a one-liner via pymodbus does
  it.
- **Relay polarity.** `relay_controller` assumes active-high modules
  (the SRD-05VDC-SL-C boards we use). HIGH on the GPIO pin closes the
  relay; LOW opens it. If a future build uses an active-low module,
  flip `_HIGH_MEANS_ON` in `relay_controller.py`.
- **GPIO permissions.** `RPi.GPIO` accesses `/dev/gpiomem` — the
  systemd unit runs as root, which has access. If you run the
  service as a non-root user, add it to the `gpio` group.
- **Mac dev.** `RPi.GPIO` can't install on macOS; the requirements
  file gates it to Linux. `relay_controller` falls back to a mock
  that logs every transition, so `--dry-run` works on a laptop.

To verify wiring on a fresh Pi:

```bash
# read once with the gateway down
python3 -c "
from pymodbus.client import ModbusSerialClient
c = ModbusSerialClient(port='/dev/ttyUSB0', baudrate=9600, timeout=2)
c.connect()
rr = c.read_input_registers(address=0, count=10, slave=1)
print('voltage:', rr.registers[0] * 0.1, 'V')
print('energy:', (rr.registers[5] | rr.registers[6]<<16), 'Wh')
"

# toggle the relay manually
python3 -c "
from ts_gateway.relay_controller import RelayController
r = RelayController([17, 27])
r.disconnect(17); input('relay open — press Enter to close')
r.connect(17); r.cleanup()
"
```

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
