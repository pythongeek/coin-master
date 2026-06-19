# CryptoFlip Development Phases

> **Project:** CryptoFlip — Provably Fair Crypto Coin Flip  
> **Source:** `PRODUCTION_ARCHITECTURE.md` (v2.0)  
> **Branch Strategy:** `main` (production), `develop` (integration), `phase/N` (feature branches)

---

## Phase 1: Foundation ✅ (COMPLETED)
**Duration:** Weeks 1–4  
**Goal:** Scaffold the entire project infrastructure so subsequent phases can focus on features, not plumbing.

### Deliverables
- [x] Git repository initialized with `.gitignore`
- [x] Project structure (`frontend/`, `backend/`, `infrastructure/`, `nginx/`, `docs/`, `monitoring/`)
- [x] Docker Compose development environment (PostgreSQL 16, Redis 7, Nginx, all services)
- [x] `backend/package.json` with all dependencies (Express, Socket.io, Prisma, BullMQ, ioredis, Zod, Pino, Helmet, CORS, rate-limit, prom-client, jose)
- [x] `backend/tsconfig.json` with strict TypeScript config and path aliases
- [x] `backend/prisma/schema.prisma` — Full production database schema (15+ models, enums, indexes, relations)
- [x] `backend/src/config/index.ts` — Zod-validated environment configuration
- [x] `backend/src/types/index.ts` — Complete TypeScript type definitions
- [x] `backend/src/utils/logger.ts` — Pino structured logging with redaction
- [x] `backend/src/middleware/errorHandler.ts` — Centralized error handling with `AppError`
- [x] `backend/src/middleware/rateLimit.ts` — Redis-backed rate limiters (per-endpoint)
- [x] `backend/src/api/health.ts` — Health, readiness, liveness, metrics endpoints
- [x] `backend/src/api/index.ts` — Express router scaffold with TODOs for all routes
- [x] `backend/src/main.ts` — API server with Helmet, CSP, CORS, HPP, compression, logging
- [x] `backend/src/ws-server.ts` — Socket.io server with room management, auth scaffold
- [x] `backend/src/worker.ts` — BullMQ worker scaffold (withdrawal, deposit, analytics, rain, notification)
- [x] `backend/Dockerfile.dev` — Development container
- [x] `frontend/package.json` — Next.js 14, React, Tailwind, Zustand, Socket.io client, Radix UI
- [x] `frontend/tsconfig.json` — Next.js TypeScript config
- [x] `frontend/next.config.js` — Next.js config with env vars
- [x] `frontend/tailwind.config.ts` — Tailwind with dark mode, shadcn-style tokens
- [x] `frontend/app/globals.css` — CSS variables for theming
- [x] `frontend/app/layout.tsx` — Root layout with dark mode, metadata
- [x] `frontend/app/page.tsx` — Landing page (hero, stats, CTA)
- [x] `frontend/lib/utils.ts` — `cn()` helper
- [x] `frontend/components/ui/button.tsx` — shadcn-style Button component
- [x] `frontend/Dockerfile.dev` — Development container
- [x] `nginx/nginx.dev.conf` — Development reverse proxy (frontend, api, websocket)
- [x] `.env.example` — All environment variables documented
- [x] `docker-compose.yml` — Full dev stack with health checks and volumes

### Next Phase Trigger
All files committed to `main`. Phase 2 branch created from `main`.

---

## Phase 2: Core Game Engine 🚧 (NEXT)
**Duration:** Weeks 5–8  
**Goal:** Make the coin flip actually work — provably fair, wallet-connected, animated, and audible.

### Deliverables
- [ ] **Provably Fair Algorithm**
  - Server seed generation + SHA-256 commitment
  - HMAC-SHA256 outcome computation
  - Client seed handling
  - Nonce incrementing per seed pair
  - Seed rotation (every 10,000 bets or 24 hours)
  - Public verification endpoint
- [ ] **Bet Engine**
  - `POST /game/bet` — Place bet with atomic balance locking (Redis Lua)
  - Bet state machine (PENDING → CONFIRMED → PROCESSING → COMPLETED)
  - Concurrent balance locking (prevents double-spend)
  - Automatic settlement with payout calculation
  - `GET /game/bet/:id` — Bet status
  - `POST /game/bet/:id/verify` — Provably fair verification
- [ ] **Wallet Integration**
  - `POST /auth/nonce` — Get nonce for wallet signature
  - `POST /auth/verify` — Verify EIP-191 signature, return JWT
  - `POST /auth/refresh` — Refresh tokens
  - `DELETE /auth/sessions` — Revoke all sessions
  - Wallet linking (`POST /wallets`, `DELETE /wallets/:id`)
  - Wallet verification via signed message
- [ ] **Balance Management**
  - Off-chain balance tracking (available + locked)
  - Deposit initiation (on-chain address generation)
  - Withdrawal queue (BullMQ async processing)
  - Transaction history (`GET /user/me/history`)
- [ ] **3D Coin Animation**
  - React Three Fiber scene setup
  - 3D coin model (Heads/Tails textures)
  - Physics-based spin animation
  - Backend-synced stop timing
  - Outcome reveal animation
- [ ] **Sound Effects**
  - Howler.js integration
  - Bet placement sound
  - Spin tension build-up
  - Win/loss outcome sounds
  - Rain trigger sound
- [ ] **Game UI**
  - Bet placement panel (amount, heads/tails)
  - Live balance display
  - Recent bet history
  - Fairness verification UI
  - Win/loss overlay
- [ ] **Testing**
  - Unit tests for game engine (100% coverage target)
  - Provably fair deterministic tests (1M runs)
  - Concurrency tests (100 concurrent bets)
  - Integration tests for full bet flow

---

## Phase 3: Social Features 🔒
**Duration:** Weeks 9–12  
**Goal:** Turn solo gambling into social gaming — squads, chat, rain.

### Deliverables
- [ ] **Squad System**
  - `POST /squads` — Create squad
  - `POST /squads/:id/join` — Join squad
  - `POST /squads/:id/leave` — Leave squad
  - `POST /squads/:id/lock` — Lock squad (creator)
  - Squad state machine (FORMING → READY → ACTIVE → DISSOLVED)
  - Auto-distribution algorithm (proportional to contribution)
  - Atomic payout execution (Serializable transaction)
  - Anti-gaming: Sybil detection, cooldowns, minimum contributions
- [ ] **Live Chat**
  - Global chat room
  - Squad-specific chat rooms
  - Message history (`GET /chat/rooms/:id/messages`)
  - Real-time via WebSocket (`chat_message`, `chat_deleted`)
  - Content moderation (profanity filter, max 500 chars)
  - Admin mute capabilities
- [ ] **Crypto Rain**
  - Trigger types: win streak, milestone, admin, scheduled
  - Budget controls (daily cap, per-claim amount, max claims)
  - `POST /rains/:id/claim` — Atomic claim with duplicate prevention
  - Real-time rain animation in chat
  - Anti-farming: IP detection, wallet age, bet history, CAPTCHA
- [ ] **Leaderboards**
  - Daily / weekly / all-time top winners
  - Top squads
  - User stats endpoint (`GET /user/me/stats`)
- [ ] **User Profiles**
  - Profile page with stats
  - Bet history with pagination
  - Win/loss charts
  - Fairness verification tool

---

## Phase 4: Web3 Integration 🔒
**Duration:** Weeks 13–16  
**Goal:** Real money on the blockchain — smart contracts, deposits, withdrawals, multi-chain.

### Deliverables
- [ ] **Smart Contract (`CryptoFlipEscrow.sol`)**
  - Deposit function (payable)
  - Bet lock/unlock (operator-only)
  - Bet settlement with payout (operator-only)
  - User withdrawal with balance check
  - House treasury with multi-sig
  - ReentrancyGuard
  - Pause mechanism
  - Events for all state changes
- [ ] **Contract Testing**
  - Foundry test suite (100% function coverage)
  - Fuzz tests for edge cases
  - Gas optimization
- [ ] **Contract Audit**
  - Third-party audit (OpenZeppelin / CertiK)
  - Bug fix cycle
  - Mainnet deployment
- [ ] **Deposit Pipeline**
  - TheGraph indexer for deposit detection
  - Webhook to backend on deposit confirmation
  - Off-chain balance crediting
  - Deposit status tracking
- [ ] **Withdrawal Pipeline**
  - `POST /wallets/:id/withdraw` — Queue to BullMQ
  - Worker processes withdrawal (smart contract call)
  - On-chain confirmation tracking
  - Transaction hash linking
- [ ] **On-Chain Reconciliation**
  - Daily balance reconciliation (off-chain vs on-chain)
  - Discrepancy detection and alerting
  - Automated reconciliation reports
- [ ] **Multi-Chain Support**
  - Ethereum (Mainnet)
  - BNB Smart Chain
  - Polygon
  - Chain abstraction layer (configurable RPCs, chain IDs)

---

## Phase 5: Security & Compliance 🔒
**Duration:** Weeks 17–20  
**Goal:** Make the platform bulletproof and legally compliant.

### Deliverables
- [ ] **KYC / AML Integration**
  - SumSub / Onfido / Jumio integration
  - 3-tier KYC (basic, enhanced, corporate)
  - Document upload and verification
  - AML screening (Chainalysis / Elliptic)
  - Sanctions list screening (OFAC, UN, EU)
- [ ] **Fraud Detection Engine**
  - Rule-based detection (velocity, sybil, collusion, rain farming)
  - Anomaly detection for withdrawal patterns
  - Automated risk scoring per user
  - Admin dashboard for risk event review
- [ ] **Rate Limiting (Production)**
  - Per-endpoint Redis-backed rate limits
  - Per-user, per-IP, per-wallet limits
  - Progressive penalties (warn → throttle → block)
  - DDoS protection integration
- [ ] **WAF & DDoS**
  - Cloudflare WAF rules
  - Bot management (JS challenge, CAPTCHA)
  - IP reputation scoring
  - Geo-blocking (sanctioned countries)
- [ ] **Penetration Testing**
  - External penetration test (OWASP Top 10)
  - Smart contract security audit
  - Bug bounty program launch (Immunefi / Bugcrowd)
- [ ] **Compliance Documentation**
  - Terms of Service
  - Privacy Policy (GDPR compliant)
  - Responsible Gambling policy
  - License application (Curacao eGaming / MGA)

---

## Phase 6: Production Hardening 🔒
**Duration:** Weeks 21–24  
**Goal:** Scale, monitor, automate, and survive anything.

### Deliverables
- [ ] **Observability Stack**
  - Prometheus metrics collection
  - Grafana dashboards (Platform, Game Engine, WebSocket, Blockchain, Security, Business)
  - Loki log aggregation
  - Jaeger distributed tracing
  - Alertmanager with PagerDuty integration
- [ ] **CI/CD Pipeline**
  - GitHub Actions: test → lint → typecheck → security audit → build → deploy
  - Docker image building and registry push
  - Blue/green deployment to VPS
  - Automated rollback on failure
  - Slack notifications
- [ ] **Infrastructure as Code**
  - Terraform for AWS/GCP/Azure
  - Docker Swarm / Kubernetes manifests
  - Nginx production configuration (SSL/TLS 1.3, HTTP/3, Brotli)
  - Multi-region setup (Phase 3)
- [ ] **Load Testing**
  - k6 scripts for 1,000 concurrent users
  - 10,000 concurrent user target
  - WebSocket connection stress tests
  - Database connection pool tuning
- [ ] **Chaos Engineering**
  - Random service failures
  - Database failover drills
  - Redis failover tests
  - Network partition simulation
- [ ] **Disaster Recovery**
  - pgBackRest automated backups (6-hour incremental, daily full)
  - S3 Glacier archival (1 year retention)
  - Monthly restore drills to staging
  - Emergency pause runbook
  - RPO < 6 hours, RTO < 2 hours
- [ ] **Documentation**
  - API documentation (OpenAPI/Swagger)
  - Deployment runbooks
  - Security incident response procedures
  - On-call rotation schedule

---

## Git Workflow

```bash
# Phase N development
 git checkout -b phase/2-core-game
# ... develop Phase 2 ...
 git add .
 git commit -m "feat(phase-2): provably fair game engine + wallet integration"
 git push origin phase/2-core-game

# Merge to develop for integration testing
 git checkout develop
 git merge phase/2-core-game
 git push origin develop

# Merge to main for production
 git checkout main
 git merge develop
 git tag v1.2.0
 git push origin main --tags
```

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Completed |
| 🚧 | In Progress |
| 🔒 | Locked (previous phase must complete) |

---

> **Current Phase:** Phase 1 ✅ COMPLETE  
> **Next Phase:** Phase 2 🚧 Core Game Engine
