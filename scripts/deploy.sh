#!/bin/bash
set -euo pipefail

# CryptoFlip Deployment Script
# Deploys to production environment

ENVIRONMENT="${1:-production}"
VERSION="${2:-latest}"
STACK_NAME="cryptoflip"

echo "Deploying CryptoFlip to ${ENVIRONMENT}..."

# Validate environment
if [ "${ENVIRONMENT}" != "production" ] && [ "${ENVIRONMENT}" != "staging" ]; then
  echo "Error: Environment must be 'production' or 'staging'"
  exit 1
fi

# Load environment variables
if [ -f ".env.${ENVIRONMENT}" ]; then
  export $(grep -v '^#' ".env.${ENVIRONMENT}" | xargs)
fi

# Pull latest images
echo "Pulling latest images..."
docker-compose -f docker-compose.prod.yml pull

# Run database migrations
echo "Running database migrations..."
docker-compose -f docker-compose.prod.yml run --rm api npx prisma migrate deploy

# Deploy with zero downtime
echo "Deploying services..."
docker-compose -f docker-compose.prod.yml up -d --no-deps --build \
  frontend api ws-game worker

# Verify health checks
echo "Verifying health checks..."
for i in {1..30}; do
  if curl -sf "http://localhost:4000/health" > /dev/null; then
    echo "Health check passed!"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "Health check failed after 30 attempts"
    exit 1
  fi
  sleep 2
done

# Prune old images
echo "Cleaning up old images..."
docker image prune -af --filter "until=24h"

echo "Deployment to ${ENVIRONMENT} completed successfully!"
