# CryptoFlip Environment Security
#
# This file documents how to securely manage production secrets.

## DO NOT COMMIT SECRETS

.env.prod must be in .gitignore and NEVER committed to the repository.

## Secret Management Options

### Option 1: Docker Secrets (Recommended for Docker Swarm)

```bash
# Create secrets
echo "YOUR_JWT_SECRET" | docker secret create cryptoflip_jwt_secret -
echo "YOUR_DB_PASSWORD" | docker secret create cryptoflip_db_password -
```

Use in docker-compose:
```yaml
secrets:
  jwt_secret:
    external: true
  db_password:
    external: true
```

### Option 2: AWS Secrets Manager (Recommended for AWS ECS)

Already configured in terraform/main.tf. Secrets are injected as environment variables at runtime.

### Option 3: HashiCorp Vault (Enterprise)

For maximum security, use Vault for dynamic secret generation and rotation.

### Option 4: .env File (Docker Compose, Local Development)

For docker-compose.prod.yml, use .env.prod file with restricted permissions:

```bash
touch .env.prod
chmod 600 .env.prod
# Edit with your secrets
```

## Secret Rotation Policy

- JWT_SECRET: Rotate every 90 days
- OPERATOR_PRIVATE_KEY: Rotate every 30 days (use multi-sig for production)
- DB_PASSWORD: Rotate every 90 days
- API Keys: Rotate every 60 days

## Generating Secrets

```bash
# JWT Secret (64 bytes)
openssl rand -base64 64

# Database Password
openssl rand -base64 32 | tr -d '=+/' | cut -c1-25

# API Key
openssl rand -hex 32
```
