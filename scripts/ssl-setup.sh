#!/bin/bash
set -euo pipefail

# CryptoFlip SSL Certificate Management Script
# Uses Certbot with ACME protocol for Let's Encrypt certificates
# Supports both production and staging (for testing) modes

DOMAIN="${1:-cryptoflip.io}"
EMAIL="${2:-admin@cryptoflip.io}"
MODE="${3:-production}"  # production | staging
CERT_DIR="./nginx/ssl"

# Create SSL directory
mkdir -p "${CERT_DIR}"

echo "===================================="
echo "CryptoFlip SSL Certificate Manager"
echo "===================================="
echo "Domain: ${DOMAIN}"
echo "Email: ${EMAIL}"
echo "Mode: ${MODE}"
echo ""

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
  echo "Certbot not found. Installing..."
  
  if command -v apt-get &> /dev/null; then
    sudo apt-get update
    sudo apt-get install -y certbot
  elif command -v yum &> /dev/null; then
    sudo yum install -y certbot
  elif command -v brew &> /dev/null; then
    brew install certbot
  else
    echo "Error: Cannot install certbot. Please install manually."
    exit 1
  fi
fi

# Determine certbot flags
CERTBOT_FLAGS=""
if [ "${MODE}" == "staging" ]; then
  CERTBOT_FLAGS="--staging"
  echo "Using Let's Encrypt STAGING environment"
fi

# Generate certificate using standalone mode (for first run)
# For renewal, use nginx plugin or webroot
echo "Generating SSL certificate for ${DOMAIN}..."

certbot certonly \
  --standalone \
  --agree-tos \
  --non-interactive \
  --email "${EMAIL}" \
  -d "${DOMAIN}" \
  -d "www.${DOMAIN}" \
  -d "api.${DOMAIN}" \
  -d "grafana.${DOMAIN}" \
  ${CERTBOT_FLAGS}

# Copy certificates to project directory
if [ -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
  echo "Copying certificates to ${CERT_DIR}..."
  
  sudo cp "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" "${CERT_DIR}/cryptoflip.crt"
  sudo cp "/etc/letsencrypt/live/${DOMAIN}/privkey.pem" "${CERT_DIR}/cryptoflip.key"
  
  # Fix permissions
  sudo chown $(whoami):$(whoami) "${CERT_DIR}/cryptoflip.crt" "${CERT_DIR}/cryptoflip.key"
  chmod 644 "${CERT_DIR}/cryptoflip.crt"
  chmod 600 "${CERT_DIR}/cryptoflip.key"
  
  echo "Certificates installed successfully!"
else
  echo "Error: Certificate directory not found"
  exit 1
fi

# Setup auto-renewal cron job
CRON_JOB="0 3 * * * certbot renew --quiet --deploy-hook 'docker-compose -f /path/to/docker-compose.prod.yml exec nginx nginx -s reload'"

if ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
  echo "Setting up auto-renewal cron job..."
  (crontab -l 2>/dev/null; echo "${CRON_JOB}") | crontab -
  echo "Auto-renewal cron job installed"
else
  echo "Auto-renewal cron job already exists"
fi

echo ""
echo "SSL Certificate Setup Complete!"
echo "Certificate: ${CERT_DIR}/cryptoflip.crt"
echo "Private Key: ${CERT_DIR}/cryptoflip.key"
echo ""
echo "To renew manually: sudo certbot renew"
