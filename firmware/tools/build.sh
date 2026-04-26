#!/usr/bin/env bash
# build.sh — produce a signed firmware bundle for OTA delivery.
#
# Inputs:
#   * Working tree at firmware/ts_gateway/
#   * Ed25519 signing key at firmware/tools/signing_key (raw 32-byte
#     private key, hex-encoded; git-ignored — see firmware/tools/.gitignore)
#
# Outputs (under firmware/releases/<version>/):
#   bundle.tar.gz       gzipped tar of the ts_gateway/ package
#   bundle.tar.gz.sha256   sha256 hex of the tarball
#   bundle.tar.gz.sig   Ed25519 signature over the sha256 hex (ascii)
#   manifest.json       version + checksum + signature + min_hardware_version
#
# Manifest gets uploaded to releases.tspowergrid.com/firmware/latest.json
# by a separate step (publishers' job, not ours).
#
# Re-running with the same version overwrites the previous bundle —
# that's intentional: we never sign two different bundles with the same
# version number.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIRMWARE_DIR="$(cd "${HERE}/.." && pwd)"
PKG_DIR="${FIRMWARE_DIR}/ts_gateway"
RELEASES_DIR="${FIRMWARE_DIR}/releases"
KEY_FILE="${HERE}/signing_key"

if [[ ! -d "${PKG_DIR}" ]]; then
    echo "package not found at ${PKG_DIR}" >&2
    exit 1
fi

# Pull the version straight out of the package — single source of truth.
VERSION="$(python3 -c "import sys; sys.path.insert(0, '${FIRMWARE_DIR}'); import ts_gateway; print(ts_gateway.__version__)")"
if [[ -z "${VERSION}" ]]; then
    echo "could not read ts_gateway.__version__" >&2
    exit 1
fi
MIN_HW="${MIN_HW:-1.0}"

OUT_DIR="${RELEASES_DIR}/${VERSION}"
mkdir -p "${OUT_DIR}"
BUNDLE="${OUT_DIR}/bundle.tar.gz"
SHA_FILE="${BUNDLE}.sha256"
SIG_FILE="${BUNDLE}.sig"
MANIFEST="${OUT_DIR}/manifest.json"

echo "==> packaging ts_gateway/ -> ${BUNDLE}  (v${VERSION})"
# tar from inside firmware/ so the archive root is `ts_gateway/...`.
# Excluded: __pycache__, *.pyc, the dev-only data/ dir, and any local
# config overrides — operators ship config.yaml separately.
tar -C "${FIRMWARE_DIR}" \
    --exclude='ts_gateway/__pycache__' \
    --exclude='ts_gateway/**/__pycache__' \
    --exclude='*.pyc' \
    --exclude='data' \
    -czf "${BUNDLE}" ts_gateway

# Deterministic-ish: gzip records mtime, but we don't care about
# byte-identical reproducibility right now. Hash the actual on-disk
# bytes the OTA client will see.
SHA="$(shasum -a 256 "${BUNDLE}" | awk '{print $1}')"
echo "${SHA}" > "${SHA_FILE}"
echo "    sha256 ${SHA}"

if [[ ! -f "${KEY_FILE}" ]]; then
    cat <<EOF
==> ERROR: signing key not found at ${KEY_FILE}

Generate one (one-time, on a trusted operator machine):

    python3 -c "
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    from cryptography.hazmat.primitives import serialization
    sk = Ed25519PrivateKey.generate()
    raw = sk.private_bytes(serialization.Encoding.Raw,
                           serialization.PrivateFormat.Raw,
                           serialization.NoEncryption())
    print(raw.hex())
    pub = sk.public_key().public_bytes(serialization.Encoding.Raw,
                                       serialization.PublicFormat.Raw)
    print('PUBKEY:', pub.hex())
    " > ${KEY_FILE}
    chmod 600 ${KEY_FILE}

Paste the PUBKEY into firmware/ts_gateway/ota.py::RELEASE_PUBKEY_HEX,
ship one firmware build with the new pubkey baked in, then start
signing real releases.
EOF
    exit 2
fi

echo "==> signing sha256 with ${KEY_FILE}"
SIG="$(python3 - "${KEY_FILE}" "${SHA}" <<'PY'
import sys
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives import serialization
key_path, sha = sys.argv[1], sys.argv[2]
with open(key_path) as fh:
    raw_hex = fh.read().strip().splitlines()[0]
sk = Ed25519PrivateKey.from_private_bytes(bytes.fromhex(raw_hex))
print(sk.sign(sha.encode("ascii")).hex())
PY
)"
echo "${SIG}" > "${SIG_FILE}"

# Assemble manifest. `bundle_url` is a placeholder — the publisher
# rewrites it to the final S3/CDN URL before uploading latest.json.
cat > "${MANIFEST}" <<EOF
{
  "version": "${VERSION}",
  "bundle_url": "https://releases.tspowergrid.com/firmware/${VERSION}/bundle.tar.gz",
  "sha256": "${SHA}",
  "signature": "${SIG}",
  "min_hardware_version": "${MIN_HW}",
  "built_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo
echo "Build complete:"
echo "  ${BUNDLE}"
echo "  ${SHA_FILE}"
echo "  ${SIG_FILE}"
echo "  ${MANIFEST}"
echo
echo "Next: upload bundle.tar.gz to releases.tspowergrid.com/firmware/${VERSION}/,"
echo "      and publish manifest.json as latest.json once smoke-tested."
