"""T&S Gateway Hub firmware.

Top-level service that runs on the Raspberry Pi at each host site:
reads meters over Modbus, reports telemetry over MQTT, and executes
remote commands.
"""

__version__ = "0.1.0"
