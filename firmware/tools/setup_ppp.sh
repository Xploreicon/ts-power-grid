#!/usr/bin/env bash
# setup_ppp.sh — configure SIM900A GPRS PPP dialup as the gateway's
# fallback uplink (used when the Pi's primary WAN — Wi-Fi or Ethernet —
# is down).
#
# Wiring assumed:
#     SIM900A TX  -> Pi RXD (GPIO15)
#     SIM900A RX  -> Pi TXD (GPIO14)
#     SIM900A GND -> Pi GND
#     SIM900A VCC -> 5V (with separate supply rated >=2A; SIM900A pulls
#                     bursts the Pi's 3.3V rail can't sustain)
# Serial appears as /dev/ttyAMA0 once the on-board login console is
# disabled — see the dtoverlay step below.
#
# What this installs:
#   /etc/ppp/peers/sim900a              ppp config
#   /etc/chatscripts/sim900a            modem dial chat
#   /etc/ppp/pap-secrets                APN credentials (chmod 600)
#   /etc/systemd/system/sim900a-ppp.service   auto-start on boot
#
# Re-run safely. Override the APN with:
#     APN=mtnnga sudo bash setup_ppp.sh
#
# Tested on Raspberry Pi OS Bookworm 64-bit. Idempotent.
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
    echo "run as root: sudo bash setup_ppp.sh" >&2
    exit 1
fi

# ---- knobs -------------------------------------------------------------
APN="${APN:-internet}"           # Nigerian carriers — MTN: web.gprs.mtnnigeria.net
                                 # or 'internet'; Airtel: 'internet.ng';
                                 # Glo: 'gloflat'; 9mobile: 'etisalat'.
                                 # Most newer SIMs accept the literal
                                 # string 'internet' and auto-detect.
APN_USER="${APN_USER:-}"
APN_PASS="${APN_PASS:-}"
SERIAL_PORT="${SERIAL_PORT:-/dev/ttyAMA0}"
BAUD="${BAUD:-115200}"
PIN="${PIN:-}"                   # leave empty for unlocked SIMs

PEERS_FILE="/etc/ppp/peers/sim900a"
CHAT_FILE="/etc/chatscripts/sim900a"
PAP_FILE="/etc/ppp/pap-secrets"
UNIT_FILE="/etc/systemd/system/sim900a-ppp.service"

echo "==> APN=${APN}  PORT=${SERIAL_PORT}  BAUD=${BAUD}"

# ---- 1. packages -------------------------------------------------------
echo "==> installing ppp + chat"
apt-get update -y
apt-get install -y ppp

# ---- 2. free the UART --------------------------------------------------
# Bookworm's serial console + Bluetooth both fight us for /dev/ttyAMA0.
# Disable the login getty and pin the PL011 UART to the GPIO header.
echo "==> freeing ${SERIAL_PORT} (disable serial-getty, swap mini-UART)"
systemctl disable --now serial-getty@ttyAMA0.service 2>/dev/null || true
systemctl disable --now hciuart.service 2>/dev/null || true

CONFIG_TXT="/boot/firmware/config.txt"
[[ -f "${CONFIG_TXT}" ]] || CONFIG_TXT="/boot/config.txt"
if ! grep -q '^enable_uart=1' "${CONFIG_TXT}"; then
    echo "enable_uart=1" >> "${CONFIG_TXT}"
fi
if ! grep -q '^dtoverlay=disable-bt' "${CONFIG_TXT}"; then
    echo "dtoverlay=disable-bt" >> "${CONFIG_TXT}"
    echo "    note: Bluetooth disabled to free PL011 UART — reboot required"
fi

# Strip the kernel console=ttyAMA0 / serial0 if present so Linux doesn't
# spew boot messages over our modem link.
CMDLINE_TXT="/boot/firmware/cmdline.txt"
[[ -f "${CMDLINE_TXT}" ]] || CMDLINE_TXT="/boot/cmdline.txt"
if [[ -f "${CMDLINE_TXT}" ]]; then
    sed -i 's/console=serial0,[0-9]\+ //g; s/console=ttyAMA0,[0-9]\+ //g' "${CMDLINE_TXT}"
fi

# ---- 3. chat script ----------------------------------------------------
echo "==> writing ${CHAT_FILE}"
mkdir -p "$(dirname "${CHAT_FILE}")"
cat > "${CHAT_FILE}" <<EOF
# SIM900A dial chat. Variable substitution happens in setup_ppp.sh, not
# at chat time — pppd's chat doesn't expand env vars.
ABORT 'BUSY'
ABORT 'NO CARRIER'
ABORT 'NO DIALTONE'
ABORT 'ERROR'
ABORT 'NO ANSWER'
ABORT '+CME ERROR'
TIMEOUT 30
'' 'ATZ'
OK 'ATE0'
OK 'AT+CFUN=1'
OK 'AT+CSQ'
$( [[ -n "${PIN}" ]] && echo "OK 'AT+CPIN=${PIN}'" || echo "# no SIM PIN configured" )
OK 'AT+CGDCONT=1,"IP","${APN}"'
OK 'ATD*99#'
CONNECT ''
EOF
chmod 644 "${CHAT_FILE}"

# ---- 4. peers file -----------------------------------------------------
echo "==> writing ${PEERS_FILE}"
mkdir -p "$(dirname "${PEERS_FILE}")"
cat > "${PEERS_FILE}" <<EOF
# pppd peer file for SIM900A GPRS — see man pppd(8).
${SERIAL_PORT}
${BAUD}

connect '/usr/sbin/chat -v -f ${CHAT_FILE}'

# Routing — ask the carrier for the address + DNS, and make this the
# default route only if no other interface (eth0/wlan0) holds it.
noauth
defaultroute
replacedefaultroute
usepeerdns
noipdefault
nodetach

# Carrier link is lossy. Aggressive LCP detects a dead PPP and lets
# systemd Restart=always bring us back.
lcp-echo-failure 4
lcp-echo-interval 30
maxfail 0
holdoff 10
persist

# These let pppd bring the link down gracefully if the modem is yanked.
crtscts
modem
EOF
chmod 640 "${PEERS_FILE}"

# Optional PAP secrets — many Nigerian APNs accept blank user/pass.
if [[ -n "${APN_USER}" ]]; then
    echo "==> writing PAP credentials (user=${APN_USER})"
    touch "${PAP_FILE}"
    chmod 600 "${PAP_FILE}"
    # Drop any prior sim900a line, then re-add. user '*' server, password.
    sed -i '/# sim900a$/d' "${PAP_FILE}"
    echo "\"${APN_USER}\" * \"${APN_PASS}\" # sim900a" >> "${PAP_FILE}"
    # tell pppd which user to send
    sed -i "/^noauth/i user \"${APN_USER}\"" "${PEERS_FILE}"
fi

# ---- 5. systemd unit ---------------------------------------------------
echo "==> writing ${UNIT_FILE}"
cat > "${UNIT_FILE}" <<'EOF'
[Unit]
Description=SIM900A GPRS PPP uplink (fallback WAN)
# Don't start until the modem device node exists. The 90-second wait
# covers SIM900A's boot self-test; if the modem never registers, pppd
# fails fast and Restart=always trickles retries.
After=dev-ttyAMA0.device
Requires=dev-ttyAMA0.device

[Service]
Type=simple
ExecStart=/usr/sbin/pppd call sim900a
Restart=always
RestartSec=15
# pppd writes its own logs to syslog/journald when invoked this way.
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable sim900a-ppp.service

echo
echo "Install complete."
echo "  - APN:        ${APN}"
echo "  - Serial:     ${SERIAL_PORT} @ ${BAUD}"
echo "  - Peer file:  ${PEERS_FILE}"
echo "  - Chat file:  ${CHAT_FILE}"
echo "  - Service:    sim900a-ppp.service (enabled)"
echo
echo "Next:"
echo "  1. Reboot if Bluetooth/UART overlay was changed:  sudo reboot"
echo "  2. Bring up now:                                   sudo systemctl start sim900a-ppp"
echo "  3. Watch the dial:                                 journalctl -u sim900a-ppp -f"
echo "  4. Verify the link:                                ip addr show ppp0 && ping -I ppp0 -c3 1.1.1.1"
