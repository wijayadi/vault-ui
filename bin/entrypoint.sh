#!/bin/sh
set -eu

if [ -n "${CUSTOM_CA_CERT:-}" ]; then
  cert_file="${TMPDIR:-/tmp}/vault-ui-custom-ca.crt"
  printf '%s\n' "$CUSTOM_CA_CERT" > "$cert_file"
  export NODE_EXTRA_CA_CERTS="$cert_file"
  echo "Vault-UI: trusting custom CA certificate at $cert_file"
fi

exec "$@"
