#!/usr/bin/env bash
# Install ts-gateway on a Raspberry Pi (Bookworm / 64-bit recommended).
#
# Idempotent — re-run safely to pick up firmware updates. The systemd
# unit is reloaded but the service is NOT restarted by this script;
# restart manually after config review:
#     sudo systemctl restart ts-gateway
#
# Layout created:
#     /opt/ts-gateway/              code (this directory, copied)
#     /opt/ts-gateway/venv/         python virtualenv
#     /etc/ts-gateway/              config + certs (chmod 600)
#     /var/lib/ts-gateway/          SQLite queue
#     /var/log/ts-gateway/          log files (journald is primary)

set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
    echo "run as root: sudo bash install.sh" >&2
    exit 1
fi

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="/opt/ts-gateway"
CONFIG_DIR="/etc/ts-gateway"
DATA_DIR="/var/lib/ts-gateway"
LOG_DIR="/var/log/ts-gateway"
VENV_DIR="${INSTALL_DIR}/venv"
SERVICE_FILE="/etc/systemd/system/ts-gateway.service"

echo "==> installing system packages"
apt-get update -y
apt-get install -y python3 python3-venv python3-pip

echo "==> creating directories"
mkdir -p "${INSTALL_DIR}" "${CONFIG_DIR}/certs" "${DATA_DIR}" "${LOG_DIR}"
chmod 700 "${CONFIG_DIR}/certs"

echo "==> copying source to ${INSTALL_DIR}"
# Copy the ts_gateway package and the systemd unit. Don't clobber
# /etc/ts-gateway/config.yaml if an operator already customised it.
cp -r "${SRC_DIR}" "${INSTALL_DIR}/ts_gateway"
if [[ ! -f "${CONFIG_DIR}/config.yaml" ]]; then
    cp "${SRC_DIR}/config.yaml" "${CONFIG_DIR}/config.yaml"
    chmod 640 "${CONFIG_DIR}/config.yaml"
    echo "    default config installed — edit ${CONFIG_DIR}/config.yaml before start"
fi

echo "==> creating virtualenv"
if [[ ! -d "${VENV_DIR}" ]]; then
    python3 -m venv "${VENV_DIR}"
fi
"${VENV_DIR}/bin/pip" install --upgrade pip
"${VENV_DIR}/bin/pip" install -r "${SRC_DIR}/requirements.txt"

echo "==> installing systemd unit"
install -m 0644 "${SRC_DIR}/ts-gateway.service" "${SERVICE_FILE}"
systemctl daemon-reload
systemctl enable ts-gateway.service

echo
echo "Install complete."
echo "  1. Edit  ${CONFIG_DIR}/config.yaml  (site_id, meter ids, cert paths)"
echo "  2. Drop certs into ${CONFIG_DIR}/certs/ (ca.crt, client.crt, client.key)"
echo "  3. sudo systemctl start ts-gateway"
echo "  4. journalctl -u ts-gateway -f"
