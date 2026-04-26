# MQTT certificates

Place mTLS material here before `docker compose up`:

```
ca.crt       # root CA (public)
server.crt   # broker server cert, CN=mqtt.tspowergrid.local
server.key   # broker server private key
```

For local development, generate a dev CA + server cert with openssl:

```bash
# CA
openssl genrsa -out ca.key 4096
openssl req -x509 -new -nodes -key ca.key -sha256 -days 3650 \
  -subj "/CN=T&S Dev CA" -out ca.crt

# Server
openssl genrsa -out server.key 4096
openssl req -new -key server.key -subj "/CN=localhost" -out server.csr
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key \
  -CAcreateserial -out server.crt -days 365 -sha256
rm server.csr
```

To provision a gateway, mint a client cert with CN=<site_id>:

```bash
SITE_ID="00000000-0000-0000-0000-000000000001"
openssl genrsa -out "${SITE_ID}.key" 4096
openssl req -new -key "${SITE_ID}.key" -subj "/CN=${SITE_ID}" \
  -out "${SITE_ID}.csr"
openssl x509 -req -in "${SITE_ID}.csr" -CA ca.crt -CAkey ca.key \
  -CAcreateserial -out "${SITE_ID}.crt" -days 365 -sha256
rm "${SITE_ID}.csr"
```

The CN is what EMQX's ACL file interpolates as `${cert_common_name}` — it
must equal the site_id for the ACL to admit the gateway.

**Never commit real certificates.** This directory is in `.gitignore`
except for this README.
