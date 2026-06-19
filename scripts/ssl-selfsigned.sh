#!/bin/bash
set -euo pipefail

# Self-signed certificate generator for local development/testing
# DO NOT USE IN PRODUCTION

CERT_DIR="./nginx/ssl"
DOMAIN="${1:-localhost}"

echo "Generating self-signed certificate for ${DOMAIN}..."
mkdir -p "${CERT_DIR}"

# Generate private key
openssl genrsa -out "${CERT_DIR}/cryptoflip.key" 2048

# Generate certificate signing request
openssl req -new \
  -key "${CERT_DIR}/cryptoflip.key" \
  -out "${CERT_DIR}/cryptoflip.csr" \
  -subj "/C=US/ST=State/L=City/O=CryptoFlip/OU=Dev/CN=${DOMAIN}"

# Generate self-signed certificate (valid for 365 days)
openssl x509 -req \
  -days 365 \
  -in "${CERT_DIR}/cryptoflip.csr" \
  -signkey "${CERT_DIR}/cryptoflip.key" \
  -out "${CERT_DIR}/cryptoflip.crt" \
  -sha256

# Clean up CSR
rm "${CERT_DIR}/cryptoflip.csr"

# Set permissions
chmod 644 "${CERT_DIR}/cryptoflip.crt"
chmod 600 "${CERT_DIR}/cryptoflip.key"

echo "Self-signed certificate generated:"
echo "  Certificate: ${CERT_DIR}/cryptoflip.crt"
echo "  Private Key: ${CERT_DIR}/cryptoflip.key"
echo ""
echo "WARNING: This is a self-signed certificate. Browsers will show a warning."
echo "For production, use Let's Encrypt with ssl-setup.sh"
