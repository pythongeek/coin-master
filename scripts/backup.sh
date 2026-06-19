#!/bin/bash
set -euo pipefail

# CryptoFlip Backup Script
# Backs up PostgreSQL database and Redis data

BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# PostgreSQL backup
echo "Starting PostgreSQL backup..."
docker exec cryptoflip-postgres-1 pg_dump \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  -Fc \
  -f "/backups/postgres_${TIMESTAMP}.dump"

# Copy from container to host
docker cp "cryptoflip-postgres-1:/backups/postgres_${TIMESTAMP}.dump" \
  "${BACKUP_DIR}/postgres_${TIMESTAMP}.dump"

# Redis backup
echo "Starting Redis backup..."
docker exec cryptoflip-redis-1 redis-cli BGSAVE
sleep 2

# Copy Redis RDB
docker cp "cryptoflip-redis-1:/data/dump.rdb" \
  "${BACKUP_DIR}/redis_${TIMESTAMP}.rdb"

# Compress backups
echo "Compressing backups..."
gzip "${BACKUP_DIR}/postgres_${TIMESTAMP}.dump"
gzip "${BACKUP_DIR}/redis_${TIMESTAMP}.rdb"

# Upload to S3 (if configured)
if [ -n "${AWS_S3_BUCKET:-}" ]; then
  echo "Uploading to S3..."
  aws s3 cp "${BACKUP_DIR}/postgres_${TIMESTAMP}.dump.gz" \
    "s3://${AWS_S3_BUCKET}/backups/postgres_${TIMESTAMP}.dump.gz"
  aws s3 cp "${BACKUP_DIR}/redis_${TIMESTAMP}.rdb.gz" \
    "s3://${AWS_S3_BUCKET}/backups/redis_${TIMESTAMP}.rdb.gz"
fi

# Clean up old backups
echo "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "postgres_*.dump.gz" -mtime +${RETENTION_DAYS} -delete
find "${BACKUP_DIR}" -name "redis_*.rdb.gz" -mtime +${RETENTION_DAYS} -delete

echo "Backup completed: ${TIMESTAMP}"
