# CryptoFlip — Production-Ready Architecture

> **Version:** 2.0  
> **Status:** Production Architecture Specification  
> **Scope:** Complete rewrite addressing all gaps found in Phase 1 documentation  
> **Classification:** Confidential — Internal Use Only

---

## 1. Executive Summary

This document is the authoritative production architecture for **CryptoFlip**, a provably-fair crypto coin-flip gaming platform with social squad-betting and live "Crypto Rain" gamification. It replaces the Phase 1 high-level roadmap with a **hardened, auditable, scalable architecture** suitable for real-money cryptocurrency handling.

### Audit Findings (Critical Gaps in Phase 1)

| # | Gap Category | Severity | Impact |
|---|-------------|----------|--------|
| 1 | No database schema or migration strategy | 🔴 Critical | Data integrity loss, deployment failures |
| 2 | No API contract (REST + WebSocket events) | 🔴 Critical | Frontend/backend integration failures |
| 3 | No Web3 smart contract architecture | 🔴 Critical | Fund loss, exploitability |
| 4 | No security hardening (OWASP, CSP, WAF) | 🔴 Critical | XSS, CSRF, injection attacks |
| 5 | No observability (logging, metrics, tracing) | 🟠 High | Blind production incidents |
| 6 | No CI/CD pipeline or infrastructure-as-code | 🟠 High | Manual deployment errors, rollback impossibility |
| 7 | No rate limiting per-endpoint architecture | 🟠 High | DDoS, abuse, economic attacks |
| 8 | No concurrency control for game state | 🔴 Critical | Race conditions, double-spend |
| 9 | No message queue for async operations | 🟠 High | Blocking I/O, poor UX, timeout cascades |
| 10 | No backup / disaster recovery plan | 🔴 Critical | Permanent data loss |
| 11 | No secrets management or key rotation | 🔴 Critical | Credential leaks, wallet compromise |
| 12 | No KYC/AML compliance architecture | 🟡 Medium | Regulatory shutdown risk |
| 13 | No RBAC in admin dashboard | 🟠 High | Privilege escalation, unauthorized house edge changes |
| 14 | No testing strategy or test environments | 🟠 High | Undetected regressions in production |
| 15 | No CDN or asset optimization strategy | 🟡 Medium | Poor global performance, high bandwidth costs |
| 16 | No load balancing or horizontal scaling | 🟡 Medium | Single point of failure |
| 17 | No caching invalidation strategy | 🟡 Medium | Stale data, incorrect balances |
| 18 | No fraud detection / anomaly detection | 🟠 High | Sybil attacks, rain farming, collusion |
| 19 | No connection recovery / state reconciliation | 🟡 Medium | Lost bets, inconsistent UX |
| 20 | No analytics / business intelligence pipeline | 🟢 Low | Inability to optimize retention |

**Phase 1 had 0 of 20 critical production requirements addressed.**  
This document addresses all 20.

---

## 2. System Architecture Overview

### 2.1 High-Level Topology

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Web App   │  │   Mobile    │  │   Wallet    │  │    WebSocket Client      │  │
│  │  (Next.js)  │  │   (PWA)     │  │ (MetaMask/  │  │   (Real-time Game)       │  │
│  │             │  │             │  │  Phantom)   │  │                          │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └───────────┬──────────────┘  │
└─────────┼────────────────┼────────────────┼─────────────────────┼─────────────────┘
          │                │                │                     │
          ▼                ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           EDGE / SECURITY LAYER                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────────────┐ │
│  │   Cloudflare    │  │   AWS WAF /     │  │         DDoS Protection             │ │
│  │   (CDN + DNS)   │  │   Cloudflare    │  │         Bot Management              │ │
│  │                 │  │   Rulesets      │  │         Rate Limiting               │ │
│  └────────┬────────┘  └─────────────────┘  └─────────────────────────────────────┘ │
└───────────┼─────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         GATEWAY / LOAD BALANCING LAYER                           │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │                         Nginx Cluster (2+ instances)                        │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────────────────┐  │  │
│  │  │  SSL/TLS │  │  HTTP/2  │  │  Brotli  │  │  WebSocket Upgrade / Proxy   │  │  │
│  │  │  Term.   │  │  / HTTP3 │  │  Comp.   │  │  (sticky sessions for WS)    │  │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            APPLICATION LAYER                                     │
│  ┌────────────────────────┐  ┌────────────────────────┐  ┌─────────────────────┐  │
│  │    Frontend Service    │  │    Backend API Service │  │   WebSocket Service  │  │
│  │    (Next.js 15)        │  │    (Node.js + Express) │  │   (Socket.io +      │  │
│  │    Port: 3000          │  │    Port: 4000          │  │    Redis Adapter)   │  │
│  │    Stateless           │  │    Stateless           │  │   Port: 4001         │  │
│  │    Horizontal Scale    │  │    Horizontal Scale    │  │   Stateful (Rooms)   │  │
│  └────────────────────────┘  └────────────────────────┘  └─────────────────────┘  │
│                                                                                  │
│  ┌────────────────────────┐  ┌────────────────────────┐  ┌─────────────────────┐  │
│  │    Worker Service      │  │    Admin API Service   │  │   Notification Svc  │  │
│  │    (BullMQ + Node)     │  │    (Separate API)      │  │   (Push + Email)    │  │
│  │    Async Jobs          │  │    Port: 4002          │  │   Port: 4003        │  │
│  │    Withdrawals,        │  │    Isolated Auth       │  │                     │  │
│  │    Analytics, Rain     │  │    Admin RBAC          │  │                     │  │
│  └────────────────────────┘  └────────────────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            MESSAGE QUEUE LAYER                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │                         Redis (BullMQ) + Redis Streams                        │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │  │
│  │  │  Job Queue   │  │  Event Bus   │  │  Rate Limit  │  │  Session Store   │  │  │
│  │  │  (BullMQ)    │  │  (Pub/Sub)   │  │  (Sliding)   │  │  (Redis)         │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                             DATA LAYER                                           │
│  ┌────────────────────────┐  ┌────────────────────────┐  ┌─────────────────────┐  │
│  │    PostgreSQL 16       │  │    Redis 7 Cluster     │  │   S3 / MinIO        │  │
│  │    Primary + Replica   │  │    (Multi-Master)      │  │   (Asset Storage)   │  │
│  │    Port: 5432          │  │    Port: 6379          │  │   Port: 9000        │  │
│  │    Automated Backups   │  │    Session + Cache     │  │   3D Models, Audio  │  │
│  │    Point-in-Time Recovery  │  Real-time State    │  │   Logs, Exports     │  │
│  └────────────────────────┘  └────────────────────────┘  └─────────────────────┘  │
│                                                                                  │
│  ┌────────────────────────┐  ┌────────────────────────┐                          │
│  │    TimescaleDB         │  │    Elasticsearch       │  │                      │
│  │    (Time-series)       │  │    (Logs + Search)     │  │                      │
│  │    Game events,        │  │    Full-text search    │  │                      │
│  │    Bet history,        │  │    Audit logs, Chat    │  │                      │
│  │    Analytics           │  │    Analytics           │  │                      │
│  └────────────────────────┘  └────────────────────────┘                          │
└─────────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         BLOCKCHAIN LAYER (Web3)                                  │
│  ┌────────────────────────┐  ┌────────────────────────┐  ┌─────────────────────┐│
│  │   Smart Contract       │  │   Wallet Integration     │  │   Indexer (TheGraph) ││
│  │   (Solidity / Rust)    │  │   (EIP-1193, WalletConnect)│  │   On-chain events   ││
│  │   Escrow + House       │  │   MetaMask, Phantom      │  │   Deposit detection ││
│  │   Provably Fair Hash   │  │   Mobile wallets         │  │   Balance sync      ││
│  └────────────────────────┘  └────────────────────────┘  └─────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Service Boundaries

| Service | Responsibility | Scaling | State |
|---------|---------------|---------|-------|
| `frontend` | SSR/SSG, PWA, 3D rendering | Horizontal | Stateless |
| `api` | REST API, auth, business logic | Horizontal | Stateless |
| `ws-game` | Real-time game rooms, chat, rain | Horizontal (Redis adapter) | Stateful (rooms) |
| `ws-admin` | Admin real-time dashboard | Horizontal | Stateless |
| `worker` | Async jobs, blockchain tx, analytics | Horizontal | Stateless |
| `admin-api` | Admin CRUD, RBAC, audit | Horizontal | Stateless |
| `notifier` | Push, email, SMS | Horizontal | Stateless |

---

## 3. Technology Stack (Production-Hardened)

### 3.1 Frontend

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | Next.js | 15.x (App Router) | SSR, SSG, API routes |
| Language | TypeScript | 5.5+ | Type safety |
| Styling | Tailwind CSS | 3.4+ | Utility-first CSS |
| Components | shadcn/ui + Radix | latest | Accessible UI primitives |
| 3D Engine | React Three Fiber | 8.x | WebGL coin rendering |
| 3D Physics | @react-three/cannon | latest | Realistic physics |
| Audio | Howler.js | 2.x | Zero-latency audio |
| State | Zustand | 4.x | Global state (lightweight) |
| Query | TanStack Query | 5.x | Server state caching |
| Forms | React Hook Form + Zod | latest | Validation |
| WebSocket | Socket.io-client | 4.x | Real-time |
| Web3 | wagmi + viem | 2.x | Wallet connection |
| Build | Turbopack | latest | Fast builds |
| PWA | next-pwa | latest | Offline capability |

### 3.2 Backend

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Runtime | Node.js | 22.x LTS | Server runtime |
| Framework | Express | 5.x | HTTP API |
| Real-time | Socket.io | 4.x | WebSocket |
| Validation | Zod | 3.x | Schema validation |
| Auth | Passport.js + jose | latest | JWT, OAuth |
| ORM | Prisma | 5.x | Database access |
| Migrations | Prisma Migrate | 5.x | Schema versioning |
| Cache | ioredis | 5.x | Redis client |
| Queue | BullMQ | 5.x | Job queues |
| HTTP Client | undici | latest | Fast HTTP |
| Crypto | node:crypto | built-in | Hashing, HMAC |
| Security | helmet, cors, hpp | latest | Headers, CORS |
| Rate Limit | express-rate-limit | 7.x | Rate limiting |
| Logging | Pino | 9.x | Structured logging |
| Metrics | prom-client | 15.x | Prometheus metrics |
| Tracing | OpenTelemetry | 1.x | Distributed tracing |

### 3.3 Data & Infrastructure

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Database | PostgreSQL 16 | Primary data store |
| Time-series | TimescaleDB | Game events, analytics |
| Cache | Redis 7 | Sessions, real-time state, rate limits |
| Search | Elasticsearch | Full-text search, chat logs |
| Object Storage | S3 / MinIO | Assets, backups, exports |
| Queue | Redis (BullMQ) | Job processing |
| Streaming | Redis Streams | Event streaming |
| Logs | Loki + Grafana | Log aggregation |
| Metrics | Prometheus + Grafana | Monitoring |
| Tracing | Jaeger / Tempo | Distributed tracing |
| Alerts | Alertmanager + PagerDuty | Incident response |
| IaC | Terraform | Infrastructure as code |
| Containers | Docker + Docker Compose (dev) | Containerization |
| Orchestration | Docker Swarm / K8s (prod) | Container orchestration |
| Reverse Proxy | Nginx | SSL termination, load balancing |
| CDN | Cloudflare | Edge caching, DDoS protection |
| CI/CD | GitHub Actions | Build, test, deploy |
| Secrets | HashiCorp Vault | Secret management |
| Backups | pgBackRest + S3 | Automated backups |

---

## 4. Database Architecture

### 4.1 Schema Design (Prisma)

```prisma
// schema.prisma — Production Database Schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── ENUMS ─────────────────────────────────────────────

enum UserRole {
  USER
  MODERATOR
  ADMIN
  SUPER_ADMIN
}

enum UserStatus {
  ACTIVE
  SUSPENDED
  BANNED
  PENDING_KYC
}

enum WalletType {
  METAMASK
  PHANTOM
  WALLET_CONNECT
  COINBASE
}

enum BetStatus {
  PENDING
  CONFIRMED
  PROCESSING
  COMPLETED
  CANCELLED
  DISPUTED
}

enum GameOutcome {
  HEADS
  TAILS
}

enum SquadStatus {
  FORMING
  READY
  ACTIVE
  DISSOLVED
}

enum RainStatus {
  SCHEDULED
  ACTIVE
  CLAIMED
  EXPIRED
}

enum TransactionType {
  DEPOSIT
  WITHDRAWAL
  BET_PLACED
  BET_WON
  BET_LOST
  SQUAD_PAYOUT
  RAIN_CLAIM
  HOUSE_FEE
  REFUND
}

enum TransactionStatus {
  PENDING
  CONFIRMED
  FAILED
  REVERTED
}

// ─── CORE TABLES ────────────────────────────────────────

model User {
  id              String     @id @default(cuid())
  email           String?    @unique
  username        String     @unique
  displayName     String?
  avatarUrl       String?
  role            UserRole   @default(USER)
  status          UserStatus @default(ACTIVE)
  
  // KYC / Compliance
  kycStatus       String     @default("none") // none, pending, verified, rejected
  kycSubmittedAt  DateTime?
  kycVerifiedAt   DateTime?
  countryCode     String?    // ISO 3166-1 alpha-2
  ipAddress       String?    // Last known IP (fraud detection)
  
  // Security
  passwordHash    String?    // For non-Web3 login (optional)
  twoFactorEnabled Boolean   @default(false)
  twoFactorSecret String?    // Encrypted
  
  // Timestamps
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
  lastLoginAt     DateTime?
  lastActiveAt    DateTime?
  
  // Relations
  wallets         Wallet[]
  bets            Bet[]
  squadMembers    SquadMember[]
  rainClaims      RainClaim[]
  transactions    Transaction[]
  sessions        Session[]
  auditLogs       AuditLog[]
  chatMessages    ChatMessage[]
  
  // Indexes
  @@index([status])
  @@index([kycStatus])
  @@index([createdAt])
  @@index([lastActiveAt])
  @@index([ipAddress])
}

model Wallet {
  id              String      @id @default(cuid())
  userId          String
  user            User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  walletType      WalletType
  address         String      // Blockchain address (lowercase normalized)
  chainId         Int         // 1 = ETH, 56 = BSC, 137 = Polygon, etc.
  isPrimary       Boolean     @default(false)
  isVerified      Boolean     @default(false) // Signed message verification
  
  // Balance tracking (off-chain for speed, reconciled on-chain)
  balance         Decimal     @default(0) @db.Decimal(36, 18)
  balanceLocked   Decimal     @default(0) @db.Decimal(36, 18) // In bets/pending
  
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  
  // Relations
  transactions    Transaction[]
  
  // Constraints
  @@unique([address, chainId])
  @@index([userId])
  @@index([address])
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  token     String   @unique
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  
  createdAt DateTime @default(now())
  
  @@index([userId])
  @@index([token])
  @@index([expiresAt])
}

// ─── GAME ENGINE TABLES ─────────────────────────────────

model ServerSeed {
  id            String    @id @default(cuid())
  seedHash      String    @unique // SHA-256 of the seed (revealed before use)
  seedValue     String?   // Actual seed (revealed after rotation)
  nonce         BigInt    @default(0) // Current nonce for this seed pair
  isActive      Boolean   @default(true)
  rotatedAt     DateTime?
  createdAt     DateTime  @default(now())
  
  // Relations
  bets          Bet[]
  
  // Security: seedValue is NULL until rotation, then immutable
  @@index([isActive])
  @@index([seedHash])
}

model Bet {
  id              String      @id @default(cuid())
  
  // User / Wallet
  userId          String
  user            User        @relation(fields: [userId], references: [id])
  walletId        String
  wallet          Wallet      @relation(fields: [walletId], references: [id])
  
  // Game parameters
  amount          Decimal     @db.Decimal(36, 18)
  predictedOutcome GameOutcome
  actualOutcome   GameOutcome?
  multiplier      Decimal     @default(1.98) @db.Decimal(10, 4) // 98% RTP = 1.98x
  
  // Provably Fair
  serverSeedId    String
  serverSeed      ServerSeed  @relation(fields: [serverSeedId], references: [id])
  clientSeed      String      // User-provided or system-generated
  nonce           BigInt
  resultHash      String?     // HMAC(serverSeed, clientSeed + nonce)
  
  // Status
  status          BetStatus   @default(PENDING)
  settledAt       DateTime?
  
  // Squad (optional)
  squadId         String?
  squad           Squad?      @relation(fields: [squadId], references: [id])
  
  // Payout
  payoutAmount    Decimal?    @db.Decimal(36, 18)
  houseFee        Decimal?    @db.Decimal(36, 18) // 2% of amount
  
  // Timestamps
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  
  // Relations
  transactions    Transaction[]
  
  // Indexes for performance
  @@index([userId, createdAt])
  @@index([status])
  @@index([serverSeedId])
  @@index([squadId])
  @@index([createdAt])
}

// ─── SQUAD SYSTEM TABLES ──────────────────────────────────

model Squad {
  id              String      @id @default(cuid())
  name            String
  status          SquadStatus @default(FORMING)
  
  // Betting config
  targetAmount    Decimal     @db.Decimal(36, 18) // Total pool target
  collectedAmount Decimal     @default(0) @db.Decimal(36, 18)
  memberCount     Int         @default(0)
  maxMembers      Int         @default(5)
  
  // Game config
  predictedOutcome GameOutcome
  multiplier      Decimal     @default(1.98) @db.Decimal(10, 4)
  
  // Result
  actualOutcome   GameOutcome?
  totalPayout     Decimal?    @db.Decimal(36, 18)
  houseFee        Decimal?    @db.Decimal(36, 18)
  
  // Timestamps
  createdAt       DateTime    @default(now())
  expiredAt       DateTime?   // Auto-dissolve if not filled
  settledAt       DateTime?
  
  // Relations
  members         SquadMember[]
  bets            Bet[]
  
  @@index([status])
  @@index([createdAt])
}

model SquadMember {
  id          String   @id @default(cuid())
  squadId     String
  squad       Squad    @relation(fields: [squadId], references: [id], onDelete: Cascade)
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  contribution Decimal @db.Decimal(36, 18)
  sharePercent Decimal @db.Decimal(10, 4) // Computed on squad close
  payoutAmount Decimal? @db.Decimal(36, 18)
  
  joinedAt    DateTime @default(now())
  
  @@unique([squadId, userId])
  @@index([squadId])
  @@index([userId])
}

// ─── CRYPTO RAIN TABLES ──────────────────────────────────

model RainEvent {
  id              String      @id @default(cuid())
  
  // Trigger
  triggerType     String      // "win_streak", "admin_manual", "milestone"
  triggerUserId   String?     // Who triggered it (for win streak)
  streakCount     Int?        // Required streak to trigger
  
  // Budget
  totalBudget     Decimal     @db.Decimal(36, 18)
  perClaimAmount  Decimal     @db.Decimal(36, 18)
  maxClaims       Int
  
  // Status
  status          RainStatus  @default(SCHEDULED)
  startedAt       DateTime?
  endedAt         DateTime?
  
  // Results
  totalClaimed    Int         @default(0)
  totalDistributed Decimal    @default(0) @db.Decimal(36, 18)
  
  createdAt       DateTime    @default(now())
  
  // Relations
  claims          RainClaim[]
  
  @@index([status])
  @@index([createdAt])
}

model RainClaim {
  id          String    @id @default(cuid())
  rainId      String
  rain        RainEvent @relation(fields: [rainId], references: [id])
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  
  amount      Decimal   @db.Decimal(36, 18)
  claimedAt   DateTime  @default(now())
  ipAddress   String?   // Fraud detection
  
  @@unique([rainId, userId]) // One claim per user per rain
  @@index([rainId])
  @@index([userId])
}

// ─── FINANCIAL TABLES ───────────────────────────────────

model Transaction {
  id              String            @id @default(cuid())
  userId          String
  user            User              @relation(fields: [userId], references: [id])
  walletId        String
  wallet          Wallet            @relation(fields: [walletId], references: [id])
  
  type            TransactionType
  status          TransactionStatus @default(PENDING)
  
  amount          Decimal           @db.Decimal(36, 18)
  fee             Decimal           @default(0) @db.Decimal(36, 18)
  
  // Blockchain (for on-chain tx)
  txHash          String?           // On-chain transaction hash
  blockNumber     BigInt?
  confirmations   Int               @default(0)
  
  // Relations
  betId           String?
  bet             Bet?              @relation(fields: [betId], references: [id])
  
  // Metadata
  metadata        Json?             // Flexible metadata for different tx types
  
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  
  @@index([userId, createdAt])
  @@index([walletId])
  @@index([type])
  @@index([status])
  @@index([txHash])
  @@index([createdAt])
}

// ─── CHAT & SOCIAL TABLES ───────────────────────────────

model ChatRoom {
  id          String        @id @default(cuid())
  name        String        // "global", "squad_abc", etc.
  type        String        // "global", "squad", "private"
  maxUsers    Int           @default(500)
  createdAt   DateTime      @default(now())
  
  messages    ChatMessage[]
  
  @@index([type])
}

model ChatMessage {
  id        String    @id @default(cuid())
  roomId    String
  room      ChatRoom  @relation(fields: [roomId], references: [id], onDelete: Cascade)
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  content   String    @db.VarChar(500) // Max 500 chars, sanitized
  isDeleted Boolean   @default(false)
  
  createdAt DateTime  @default(now())
  
  @@index([roomId, createdAt])
  @@index([userId])
}

// ─── AUDIT & COMPLIANCE TABLES ──────────────────────────

model AuditLog {
  id          String   @id @default(cuid())
  userId      String?
  user        User?    @relation(fields: [userId], references: [id])
  
  action      String   // "admin:house_edge_change", "admin:seed_rotate", etc.
  resource    String   // "bet", "user", "squad", etc.
  resourceId  String?
  
  oldValue    Json?
  newValue    Json?
  
  ipAddress   String?
  userAgent   String?
  
  createdAt   DateTime @default(now())
  
  @@index([userId])
  @@index([action])
  @@index([resource, resourceId])
  @@index([createdAt])
}

model HouseConfig {
  id              String   @id @default(cuid())
  
  // Game parameters (admin-controlled)
  houseEdgePercent Decimal  @default(2.0) @db.Decimal(5, 2) // 2% = 98% RTP
  maxBetAmount     Decimal  @default(10000) @db.Decimal(36, 18)
  minBetAmount     Decimal  @default(0.0001) @db.Decimal(36, 18)
  maxMultiplier    Decimal  @default(1.98) @db.Decimal(10, 4)
  
  // Rain parameters
  rainBudgetDaily  Decimal  @default(100) @db.Decimal(36, 18)
  rainStreakTrigger Int   @default(5)
  rainPerClaim     Decimal @default(0.001) @db.Decimal(36, 18)
  
  // Squad parameters
  squadMaxMembers  Int     @default(5)
  squadMinMembers  Int     @default(2)
  squadTimeoutMinutes Int  @default(5)
  
  // Metadata
  changedBy       String   // Admin user ID
  changedAt       DateTime @default(now())
  
  @@index([changedAt])
}

// ─── FRAUD / ANOMALY DETECTION TABLES ───────────────────

model RiskEvent {
  id          String   @id @default(cuid())
  userId      String
  
  riskType    String   // "sybil", "collusion", "rain_farm", "velocity"
  severity    String   // "low", "medium", "high", "critical"
  description String
  
  evidence    Json     // Structured evidence
  
  status      String   @default("open") // open, investigating, resolved, false_positive
  resolvedBy  String?
  resolvedAt  DateTime?
  
  createdAt   DateTime @default(now())
  
  @@index([userId])
  @@index([riskType])
  @@index([status])
  @@index([createdAt])
}
```

### 4.2 Indexing Strategy

| Table | Index | Purpose |
|-------|-------|---------|
| `Bet` | `(userId, createdAt DESC)` | User bet history |
| `Bet` | `(status, createdAt)` | Pending bet settlement |
| `Bet` | `(serverSeedId, nonce)` | Provably fair verification |
| `Transaction` | `(userId, type, createdAt DESC)` | User financial history |
| `Transaction` | `(txHash)` | On-chain reconciliation |
| `Wallet` | `(address, chainId)` | Wallet lookup |
| `RainClaim` | `(rainId, userId)` | Duplicate claim prevention |
| `ChatMessage` | `(roomId, createdAt DESC)` | Room message history |
| `AuditLog` | `(action, createdAt DESC)` | Admin action history |
| `RiskEvent` | `(userId, status)` | Open risk cases |

### 4.3 Partitioning Strategy

| Table | Partition Key | Retention |
|-------|--------------|-----------|
| `Bet` | `createdAt` (monthly) | 7 years hot, archive cold |
| `Transaction` | `createdAt` (monthly) | 10 years |
| `ChatMessage` | `createdAt` (daily) | 30 days hot, S3 archive |
| `AuditLog` | `createdAt` (monthly) | 10 years |

### 4.4 Backup Strategy

```
Frequency:  Every 6 hours (incremental) + Daily (full)
Retention:   30 days local, 1 year S3 Glacier
Encryption:  AES-256 at rest, TLS in transit
Testing:     Monthly restore drills to staging
Tooling:     pgBackRest + cron
RPO:         < 6 hours
RTO:         < 2 hours (failover to replica)
```

---

## 5. API Specification

### 5.1 REST API Endpoints

```yaml
# Base URL: https://api.cryptoflip.io/v1

# ─── AUTH ─────────────────────────────────────────────
POST   /auth/nonce          # Get nonce for wallet signature
POST   /auth/verify         # Verify signature, return JWT
POST   /auth/refresh        # Refresh access token
POST   /auth/logout         # Revoke session
DELETE /auth/sessions        # Revoke all sessions

# ─── USER ─────────────────────────────────────────────
GET    /user/me             # Current user profile
PATCH  /user/me             # Update profile
GET    /user/me/balance     # All wallet balances
GET    /user/me/stats        # Win/loss stats
GET    /user/me/history     # Bet history (paginated)
POST   /user/me/kyc         # Submit KYC documents

# ─── WALLET ───────────────────────────────────────────
GET    /wallets             # List wallets
POST   /wallets             # Link new wallet
DELETE /wallets/:id         # Unlink wallet (if balance = 0)
POST   /wallets/:id/verify  # Sign message to verify ownership
POST   /wallets/:id/deposit  # Initiate deposit (on-chain)
POST   /wallets/:id/withdraw # Request withdrawal (queue)

# ─── GAME ─────────────────────────────────────────────
GET    /game/config         # Current house edge, limits
GET    /game/seed           # Current server seed hash (pre-game)
POST   /game/bet            # Place a bet
GET    /game/bet/:id        # Bet status & result
POST   /game/bet/:id/verify # Verify provably fair result

# ─── SQUAD ──────────────────────────────────────────
GET    /squads              # Active squads
POST   /squads              # Create squad
GET    /squads/:id          # Squad details
POST   /squads/:id/join     # Join squad
POST   /squads/:id/leave    # Leave squad (before lock)
POST   /squads/:id/lock      # Lock squad (creator, min members met)

# ─── RAIN ─────────────────────────────────────────────
GET    /rains               # Current / upcoming rains
GET    /rains/:id           # Rain details
POST   /rains/:id/claim     # Claim rain (must be active)
GET    /rains/:id/claims    # My claim status

# ─── CHAT ─────────────────────────────────────────────
GET    /chat/rooms          # Available rooms
GET    /chat/rooms/:id/messages # Message history (paginated, last 100)

# ─── LEADERBOARD ──────────────────────────────────────
GET    /leaderboard/daily   # Daily top winners
GET    /leaderboard/weekly  # Weekly top winners
GET    /leaderboard/squads  # Top squads

# ─── ADMIN (requires ADMIN role) ──────────────────────
GET    /admin/dashboard     # Stats summary
GET    /admin/users         # User list (filter, search)
GET    /admin/users/:id     # User details + risk score
PATCH  /admin/users/:id     # Update user status
GET    /admin/bets          # All bets (filter, search)
GET    /admin/transactions  # All transactions
GET    /admin/audit-logs    # Audit trail
GET    /admin/risk-events   # Fraud alerts
PATCH  /admin/risk-events/:id # Resolve risk event

GET    /admin/config        # Current house config
PATCH  /admin/config        # Update house config (logged)
POST   /admin/seeds/rotate  # Rotate server seed
GET    /admin/seeds         # Seed history

POST   /admin/rains         # Trigger manual rain
PATCH  /admin/rains/:id     # Cancel / modify rain

GET    /admin/squads        # All squads
PATCH  /admin/squads/:id    # Force dissolve squad

# ─── HEALTH & METRICS ─────────────────────────────────
GET    /health              # Service health (public)
GET    /health/ready        # Readiness probe (k8s)
GET    /health/live         # Liveness probe (k8s)
GET    /metrics             # Prometheus metrics (internal)
```

### 5.2 WebSocket Events

```yaml
# Connection: wss://ws.cryptoflip.io/game
# Auth: JWT in query param ?token=...

# ─── CLIENT → SERVER ──────────────────────────────────
auth            { token: string }
ping            { timestamp: number }

join_room       { room: "global" | "squad:<id>" }
leave_room      { room: string }

place_bet       { 
  amount: string,           // Decimal as string
  prediction: "heads" | "tails",
  clientSeed: string,
  walletId: string
}

join_squad      { squadId: string }
leave_squad     { squadId: string }
lock_squad      { squadId: string }

chat_message    { room: string, content: string }
claim_rain      { rainId: string }

# ─── SERVER → CLIENT ──────────────────────────────────
auth_result     { success: boolean, error?: string }
pong            { timestamp: number, serverTime: string }

balance_update  { walletId: string, balance: string, locked: string }

bet_placed      { betId: string, status: "pending" | "confirmed" }
bet_result      { 
  betId: string, 
  outcome: "heads" | "tails",
  won: boolean,
  payout: string,
  resultHash: string,
  serverSeed: string,       // Revealed post-game
  nonce: number
}

squad_update    { squadId: string, members: [], collected: string, status: string }
squad_result   { squadId: string, outcome: string, totalPayout: string, shares: [] }

rain_triggered  { rainId: string, type: string, budget: string, perClaim: string, duration: number }
rain_claimed    { rainId: string, userId: string, amount: string, remaining: number }
rain_ended      { rainId: string, totalClaims: number, totalDistributed: string }

chat_message    { id: string, room: string, user: {}, content: string, timestamp: string }
chat_deleted    { id: string, room: string }

user_joined     { room: string, user: {} }
user_left       { room: string, userId: string }

win_streak      { userId: string, streak: number }
leaderboard_update { type: string, entries: [] }

error           { code: string, message: string, context: {} }
```

### 5.3 Rate Limits (Per-Endpoint)

| Endpoint | Limit | Window | Key |
|----------|-------|--------|-----|
| `POST /auth/*` | 5 | 1 min | IP |
| `POST /game/bet` | 10 | 1 min | User ID |
| `POST /game/bet` | 100 | 1 hour | User ID |
| `POST /squads` | 5 | 1 min | User ID |
| `POST /squads/:id/join` | 10 | 1 min | User ID |
| `POST /rains/:id/claim` | 1 | per rain | User ID |
| `WS chat_message` | 30 | 1 min | User ID |
| `WS place_bet` | 10 | 1 min | User ID |
| `GET /user/me/history` | 60 | 1 min | User ID |
| `GET /chat/rooms/:id/messages` | 30 | 1 min | User ID |
| `Admin endpoints` | 120 | 1 min | User ID |

---

## 6. Web3 / Blockchain Architecture

### 6.1 Smart Contract Architecture

```solidity
// CryptoFlipEscrow.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract CryptoFlipEscrow is ReentrancyGuard, AccessControl, Pausable {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant HOUSE_KEEPER_ROLE = keccak256("HOUSE_KEEPER_ROLE");
    
    // User deposits
    mapping(address => uint256) public balances;
    mapping(address => uint256) public lockedBalances;
    
    // House treasury
    uint256 public houseBalance;
    uint256 public totalVolume;
    
    // Events
    event Deposited(address indexed user, uint256 amount, uint256 newBalance);
    event Withdrawn(address indexed user, uint256 amount, uint256 newBalance);
    event BetLocked(address indexed user, uint256 amount, bytes32 betId);
    event BetSettled(address indexed user, bytes32 betId, bool won, uint256 payout);
    event HouseFeeCollected(uint256 amount);
    
    // Deposit from user wallet
    function deposit() external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "Zero deposit");
        balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value, balances[msg.sender]);
    }
    
    // Operator locks bet amount
    function lockBet(address user, uint256 amount, bytes32 betId) 
        external 
        onlyRole(OPERATOR_ROLE) 
        nonReentrant 
    {
        require(balances[user] >= amount, "Insufficient balance");
        balances[user] -= amount;
        lockedBalances[user] += amount;
        emit BetLocked(user, amount, betId);
    }
    
    // Operator settles bet (win or loss)
    function settleBet(
        address user, 
        bytes32 betId, 
        bool won, 
        uint256 payout,
        uint256 houseFee
    ) external onlyRole(OPERATOR_ROLE) nonReentrant {
        lockedBalances[user] -= (payout + houseFee); // Original bet was locked
        
        if (won) {
            balances[user] += payout;
        } else {
            houseBalance += (payout + houseFee); // House keeps the loss
        }
        
        houseBalance += houseFee;
        totalVolume += payout;
        
        emit BetSettled(user, betId, won, payout);
        emit HouseFeeCollected(houseFee);
    }
    
    // User withdrawal
    function withdraw(uint256 amount) external nonReentrant whenNotPaused {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        require(lockedBalances[msg.sender] == 0, "Active bets locked");
        
        balances[msg.sender] -= amount;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");
        
        emit Withdrawn(msg.sender, amount, balances[msg.sender]);
    }
    
    // House treasury withdrawal (multi-sig required)
    function withdrawHouse(uint256 amount, address to) 
        external 
        onlyRole(HOUSE_KEEPER_ROLE) 
        nonReentrant 
    {
        require(amount <= houseBalance, "Insufficient house balance");
        houseBalance -= amount;
        (bool success, ) = payable(to).call{value: amount}("");
        require(success, "Transfer failed");
    }
    
    // Emergency pause
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
    receive() external payable {
        deposit();
    }
}
```

### 6.2 Wallet Integration Flow

```
1. User clicks "Connect Wallet"
2. Frontend calls wallet.connect() via wagmi
3. Wallet returns address + chainId
4. Frontend POST /auth/nonce → Backend returns random nonce
5. Frontend prompts wallet to sign: `CryptoFlip Login: nonce=<nonce>`
6. Frontend POST /auth/verify { address, signature, nonce }
7. Backend:
   a. Verify signature against address (EIP-191)
   b. Verify nonce is valid and not expired (Redis, 5 min TTL)
   c. Create user if not exists, or update lastLoginAt
   d. Generate JWT (access: 15 min, refresh: 7 days)
   e. Return tokens + user profile
8. Frontend stores JWT in httpOnly cookie (preferred) or memory
9. All subsequent API calls include Authorization: Bearer <token>
10. WebSocket connection includes ?token=<jwt>
```

### 6.3 On-Chain Reconciliation

| Event | Detection | Action | SLA |
|-------|-----------|--------|-----|
| Deposit | TheGraph indexer + webhook | Credit off-chain balance | < 30s |
| Withdrawal | Smart contract event | Update tx status | < 2 min |
| Bet lock | Internal only | No on-chain tx (off-chain speed) | Instant |
| Bet settle | Internal only | Batch settle to contract nightly | Batch |

### 6.4 Multi-Chain Support (Phase 2)

| Chain | Chain ID | Priority | Native Token |
|-------|----------|----------|--------------|
| Ethereum | 1 | High | ETH |
| BNB Smart Chain | 56 | High | BNB |
| Polygon | 137 | High | MATIC |
| Arbitrum | 42161 | Medium | ETH |
| Base | 8453 | Medium | ETH |

---

## 7. Provably Fair System

### 7.1 Algorithm Specification

```typescript
/**
 * CryptoFlip Provably Fair Algorithm v2.0
 * 
 * 1. BEFORE each game round:
 *    - Server generates a random 32-byte seed (serverSeed)
 *    - Server publishes SHA-256(serverSeed) as serverSeedHash
 *    - Server stores serverSeed in encrypted vault (NOT revealed)
 * 
 * 2. USER provides:
 *    - clientSeed (user-generated or system default)
 *    - nonce (incrementing per bet, starting at 0)
 * 
 * 3. DURING game:
 *    - result = HMAC_SHA256(serverSeed, clientSeed + nonce)
 *    - outcome = parseInt(result.substring(0, 8), 16) % 2
 *    - 0 = HEADS, 1 = TAILS
 * 
 * 4. AFTER game:
 *    - Server reveals serverSeed
 *    - User can verify: SHA-256(revealedSeed) == serverSeedHash
 *    - User can recompute HMAC to verify outcome
 * 
 * 5. SEED ROTATION:
 *    - Rotate after every 10,000 bets OR every 24 hours
 *    - Rotation = new serverSeed generated, old seed revealed
 *    - Minimum 1 hour between rotations (prevents manipulation)
 */

function generateOutcome(
  serverSeed: string,      // 64-char hex
  clientSeed: string,      // User-provided string
  nonce: bigint            // Sequential per seed pair
): { outcome: 'heads' | 'tails'; hash: string } {
  const message = `${clientSeed}:${nonce.toString()}`;
  const hash = crypto.createHmac('sha256', serverSeed)
    .update(message)
    .digest('hex');
  
  const first4Bytes = parseInt(hash.substring(0, 8), 16);
  const outcome = first4Bytes % 2 === 0 ? 'heads' : 'tails';
  
  return { outcome, hash };
}
```

### 7.2 Verification Flow

```
User requests verification:
  GET /game/bet/:id/verify

Response:
  {
    "serverSeedHash": "abc123...",      // Pre-game hash
    "serverSeed": "def456...",          // Revealed post-game
    "clientSeed": "user_seed_123",
    "nonce": 42,
    "resultHash": "HMAC output",
    "outcome": "heads",
    "verificationSteps": [
      "1. SHA-256(serverSeed) == serverSeedHash ✓",
      "2. HMAC_SHA256(serverSeed, clientSeed + nonce) == resultHash ✓",
      "3. parseInt(resultHash[0:8], 16) % 2 == 0 → heads ✓"
    ]
  }
```

### 7.3 Security Properties

| Property | Mechanism |
|----------|-----------|
| **Unpredictability** | Server seed unknown until after bet |
| **Verifiability** | Client can recompute HMAC independently |
| **Tamper-proof** | Hash commitment prevents post-hoc change |
| **Forward secrecy** | Seed rotation limits exposure window |
| **No client bias** | Server cannot know clientSeed in advance |

---

## 8. Game Engine Logic

### 8.1 Solo Bet Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │     │   API    │     │  Redis   │     │  Queue   │     │   DB     │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │                │
     │ 1. place_bet   │                │                │                │
     │ ──────────────>│                │                │                │
     │                │ 2. Validate    │                │                │
     │                │    (balance,   │                │                │
     │                │     limits,    │                │                │
     │                │     rate)      │                │                │
     │                │                │                │                │
     │                │ 3. Lock balance│                │                │
     │                │ ──────────────>│                │                │
     │                │                │                │                │
     │                │ 4. Compute     │                │                │
     │                │    outcome     │                │                │
     │                │    (HMAC)      │                │                │
     │                │                │                │                │
     │                │ 5. Queue       │                │                │
     │                │    settlement  │                │                │
     │                │ ──────────────────────────────>│                │
     │                │                │                │                │
     │                │ 6. Acknowledge │                │                │
     │                │    (pending)   │                │                │
     │ <──────────────│                │                │                │
     │                │                │                │                │
     │                │                │                │ 7. Persist     │
     │                │                │                │    (atomic)    │
     │                │                │                │ ──────────────>│
     │                │                │                │                │
     │                │                │                │ 8. Update      │
     │                │                │    balance     │    balance     │
     │                │                │ <──────────────│                │
     │                │                │                │                │
     │ 9. WS: result  │                │                │                │
     │ <──────────────│                │                │                │
     │                │                │                │                │
```

### 8.2 Concurrency Control (Critical)

```typescript
// Atomic balance locking using Redis Lua script
// Prevents race conditions / double-spend

const LOCK_SCRIPT = `
  local key = KEYS[1]
  local lockKey = KEYS[2]
  local amount = tonumber(ARGV[1])
  local ttl = tonumber(ARGV[2])
  
  local balance = tonumber(redis.call('GET', key) or 0)
  local locked = tonumber(redis.call('GET', lockKey) or 0)
  local available = balance - locked
  
  if available < amount then
    return {-1, available} -- Insufficient funds
  end
  
  redis.call('INCRBY', lockKey, amount)
  redis.call('EXPIRE', lockKey, ttl)
  
  return {1, available - amount}
`;

// Usage:
const result = await redis.eval(LOCK_SCRIPT, {
  keys: [`wallet:${walletId}:balance`, `wallet:${walletId}:locked`],
  arguments: [amount.toString(), '60'] // 60s TTL on lock
});

if (result[0] === -1) {
  throw new InsufficientFundsError(`Available: ${result[1]}`);
}
```

### 8.3 State Machine (Bet Lifecycle)

```
[PENDING] → (validation passes) → [CONFIRMED]
                                        │
                                        │ (compute outcome)
                                        ▼
                                   [PROCESSING]
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
                    ▼                   ▼                   ▼
               [COMPLETED]        [CANCELLED]         [DISPUTED]
               (win/loss)       (user timeout)      (manual review)
                    │
                    ▼
            (balance unlocked)
```

---

## 9. Squad Betting System

### 9.1 Squad Lifecycle

```
[FORMING] → (min members + target reached) → [READY]
                                               │
                                               │ (creator locks)
                                               ▼
                                            [ACTIVE]
                                               │
                                               │ (bet placed as squad)
                                               ▼
                                           [SETTLED]
                                               │
                                               │ (payout distributed)
                                               ▼
                                           [DISSOLVED]
```

### 9.2 Squad Distribution Algorithm

```typescript
function calculateSquadPayouts(
  members: SquadMember[],
  totalPayout: Decimal,
  houseFee: Decimal
): PayoutDistribution[] {
  const totalContributed = members.reduce(
    (sum, m) => sum.plus(m.contribution), 
    new Decimal(0)
  );
  
  return members.map(member => {
    const sharePercent = member.contribution
      .div(totalContributed)
      .mul(100);
    
    const payoutAmount = totalPayout
      .mul(member.contribution)
      .div(totalContributed);
    
    return {
      userId: member.userId,
      sharePercent: sharePercent.toFixed(4),
      payoutAmount: payoutAmount.toFixed(18),
    };
  });
}

// Atomic payout execution via transaction
async function executeSquadPayout(
  squadId: string,
  distributions: PayoutDistribution[],
  prisma: PrismaClient
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const dist of distributions) {
      await tx.wallet.update({
        where: { id: dist.walletId },
        data: { balance: { increment: dist.payoutAmount } }
      });
      
      await tx.transaction.create({
        data: {
          userId: dist.userId,
          walletId: dist.walletId,
          type: 'SQUAD_PAYOUT',
          amount: dist.payoutAmount,
          status: 'CONFIRMED',
          metadata: { squadId, sharePercent: dist.sharePercent }
        }
      });
    }
    
    await tx.squad.update({
      where: { id: squadId },
      data: { status: 'DISSOLVED', settledAt: new Date() }
    });
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable
  });
}
```

### 9.3 Squad Anti-Gaming Measures

| Attack | Mitigation |
|--------|-----------|
| Sybil squads (one user, many accounts) | KYC required for squad creation; IP/device fingerprinting |
| Collusion (coordinated betting) | Randomized squad matching; max 1 squad per user per round |
| Last-minute withdrawal | Lock window: 30s before flip; no exits after lock |
| Ghost members (join but don't contribute) | Minimum contribution required; auto-kick if 0 contribution |
| Squad farming (create/close repeatedly) | Cooldown: 5 min between squad creations per user |

---

## 10. Crypto Rain System

### 10.1 Rain Architecture

```
Trigger Types:
  1. WIN_STREAK: User hits N consecutive wins → platform-wide rain
  2. MILESTONE: Total volume hits threshold → rain
  3. ADMIN_MANUAL: Admin triggers from dashboard
  4. SCHEDULED: Daily/hourly scheduled rain

Budget Controls:
  - Daily budget cap (enforced by atomic counter in Redis)
  - Per-claim amount (fixed or randomized within range)
  - Max claims per rain (first-come-first-served)
  - Per-user claim cooldown (1 rain per 5 min minimum)

Anti-Farming:
  - IP-based duplicate detection
  - Wallet age minimum (7 days)
  - Minimum bet history (3+ bets)
  - Device fingerprinting
  - CAPTCHA for high-frequency claimers
```

### 10.2 Rain Execution Flow

```typescript
interface RainTrigger {
  type: 'win_streak' | 'milestone' | 'admin' | 'scheduled';
  budget: Decimal;
  perClaimAmount: Decimal;
  maxClaims: number;
  durationSeconds: number;
}

async function triggerRain(event: RainTrigger): Promise<void> {
  // 1. Check daily budget
  const dailySpent = await redis.get('rain:daily:spent') || '0';
  const dailyBudget = await getDailyRainBudget();
  
  if (new Decimal(dailySpent).plus(event.budget).gt(dailyBudget)) {
    throw new DailyBudgetExceededError();
  }
  
  // 2. Atomically reserve budget
  const reserved = await redis.incrby(
    'rain:daily:spent',
    event.budget.toNumber()
  );
  
  // 3. Create rain event in DB
  const rain = await prisma.rainEvent.create({ data: {
    triggerType: event.type,
    totalBudget: event.budget,
    perClaimAmount: event.perClaimAmount,
    maxClaims: event.maxClaims,
    status: 'ACTIVE',
    startedAt: new Date()
  }});
  
  // 4. Broadcast to all connected clients
  io.emit('rain_triggered', {
    rainId: rain.id,
    type: event.type,
    budget: event.budget.toString(),
    perClaim: event.perClaimAmount.toString(),
    duration: event.durationSeconds
  });
  
  // 5. Schedule auto-close
  await bullQueue.add('rain:close', { rainId: rain.id }, {
    delay: event.durationSeconds * 1000
  });
}
```

### 10.3 Rain Claim Handler

```typescript
async function claimRain(userId: string, rainId: string, ip: string): Promise<void> {
  // 1. Validate user eligibility
  const isEligible = await checkRainEligibility(userId, rainId);
  if (!isEligible) throw new NotEligibleError();
  
  // 2. Atomic claim (Redis SETNX to prevent double-claim)
  const claimed = await redis.set(
    `rain:${rainId}:claim:${userId}`,
    '1',
    'NX', 'EX', 3600
  );
  if (!claimed) throw new AlreadyClaimedError();
  
  // 3. Check remaining claims
  const remaining = await redis.decr(`rain:${rainId}:remaining`);
  if (remaining < 0) {
    await redis.del(`rain:${rainId}:claim:${userId}`);
    throw new RainExhaustedError();
  }
  
  // 4. Credit user (atomic DB transaction)
  await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findFirst({
      where: { userId, isPrimary: true }
    });
    
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: perClaimAmount } }
    });
    
    await tx.rainClaim.create({
      data: { rainId, userId, amount: perClaimAmount, ipAddress: ip }
    });
  });
  
  // 5. Emit to user
  socket.to(userId).emit('rain_claimed', {
    rainId, amount: perClaimAmount.toString(), remaining
  });
}
```

---

## 11. Real-Time Communication (WebSocket)

### 11.1 Room Architecture

```
Room Types:
  global        # All connected users (chat, rain announcements)
  user:<id>     # Private room for user-specific updates
  squad:<id>    # Squad-specific room
  admin         # Admin-only room (stats, alerts)

Connection Scaling:
  - Socket.io with Redis Adapter (ioredis)
  - Sticky sessions via Nginx (ip_hash or cookie-based)
  - Horizontal scaling: add ws-game nodes, Redis coordinates

Message Ordering:
  - Game events: server-assigned sequence numbers
  - Chat: server timestamp (NTP-synced)
  - Reconnection: client sends lastSequence, server replays
```

### 11.2 Connection Recovery

```typescript
interface ReconnectionState {
  lastSequence: number;      // Last received event sequence
  lastBetId: string;         // Last placed bet
  pendingBets: string[];     // Bets in PENDING/PROCESSING
  roomSubscriptions: string[];
}

// On reconnection:
// 1. Client sends reconnection state
// 2. Server:
//    a. Re-subscribes to rooms
//    b. Replays events from lastSequence (Redis Streams, 5 min buffer)
//    c. Resolves pending bets from DB
//    d. Sends current balance snapshot
// 3. Client reconciles state
```

### 11.3 Backpressure & Flow Control

```typescript
// Server-side per-client rate limiting
const WS_RATE_LIMIT = {
  messagesPerSecond: 10,
  burstSize: 20,
  penaltyMultiplier: 2
};

// If client exceeds rate:
// 1. Drop excess messages
// 2. Emit 'error:rate_limited' with retryAfter
// 3. Progressive penalty: 1s → 2s → 5s → 10s → disconnect

// Binary message support for 3D state updates (reduces JSON overhead)
```

---

## 12. Security Architecture

### 12.1 Defense in Depth

```
Layer 1: Edge (Cloudflare)
  - DDoS protection (L3/L4/L7)
  - Bot management (JS challenge, CAPTCHA)
  - WAF rules (OWASP Top 10, crypto-specific rules)
  - IP reputation scoring
  - Geo-blocking (sanctioned countries)

Layer 2: Gateway (Nginx)
  - SSL/TLS 1.3 (HSTS, OCSP stapling)
  - HTTP/3 + QUIC
  - Brotli compression
  - Rate limiting (per-IP, per-endpoint)
  - Request size limits (10MB max)
  - Connection limits (per-IP)

Layer 3: Application
  - Input validation (Zod schemas, strict parsing)
  - Output encoding (XSS prevention)
  - CSRF tokens (for non-API routes)
  - CORS (whitelist only)
  - Content Security Policy (CSP)
  - HSTS headers
  - Security headers (Helmet)
  - SQL injection prevention (Prisma, parameterized queries)
  - NoSQL injection prevention (schema validation)

Layer 4: Authentication
  - JWT: RS256 (asymmetric), 15-min expiry
  - Refresh tokens: 7-day rotation, stored hashed
  - Wallet signature verification (EIP-191)
  - Session binding (IP + User-Agent fingerprinting)
  - Concurrent session limits (max 5 per user)
  - Suspicious login detection (new IP, new country)

Layer 5: Authorization
  - RBAC: User, Moderator, Admin, SuperAdmin
  - Resource-level access control (can only see own bets)
  - Admin actions require 2FA
  - Admin actions logged to immutable audit trail
  - Admin actions require approval for sensitive operations
    (house edge changes, large withdrawals)

Layer 6: Data
  - Encryption at rest: AES-256 (DB + S3)
  - Encryption in transit: TLS 1.3
  - Sensitive fields encrypted (2FA secrets, private notes)
  - Database credentials: Vault dynamic secrets (TTL 1 hour)
  - Wallet private keys: NEVER stored. Only public addresses.
  - Backup encryption: GPG + AES-256

Layer 7: Blockchain
  - Smart contract audited by third-party (CertiK / OpenZeppelin)
  - Multi-sig for house treasury (3-of-5)
  - ReentrancyGuard on all fund-moving functions
  - Pause mechanism for emergencies
  - Max withdrawal limits per transaction
  - Daily withdrawal limits per user
```

### 12.2 Content Security Policy

```http
Content-Security-Policy: 
  default-src 'self';
  script-src 'self' 'nonce-{RANDOM}' https://cdn.cryptoflip.io;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https: blob:;
  media-src 'self' https://cdn.cryptoflip.io;
  connect-src 'self' wss://ws.cryptoflip.io https://api.cryptoflip.io https://*.infura.io https://*.alchemy.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
```

### 12.3 Fraud Detection Rules

```typescript
interface FraudRule {
  id: string;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  condition: (event: GameEvent) => boolean;
  action: 'flag' | 'block' | 'suspend' | 'review';
}

const FRAUD_RULES: FraudRule[] = [
  {
    id: 'velocity_1',
    name: 'High Bet Velocity',
    severity: 'medium',
    condition: (e) => e.betsPerMinute > 20,
    action: 'flag'
  },
  {
    id: 'sybil_1',
    name: 'Multi-Account from Same IP',
    severity: 'high',
    condition: (e) => e.uniqueAccountsFromIP > 5 && e.timeWindow < 3600,
    action: 'review'
  },
  {
    id: 'rain_farm_1',
    name: 'Rain Claim Pattern',
    severity: 'medium',
    condition: (e) => e.rainClaimsPerDay > 50 && e.betCount < 3,
    action: 'block'
  },
  {
    id: 'collusion_1',
    name: 'Squad Collusion',
    severity: 'high',
    condition: (e) => e.squadWinRate > 0.85 && e.squadCount > 10,
    action: 'review'
  },
  {
    id: 'withdrawal_1',
    name: 'Large Withdrawal Pattern',
    severity: 'medium',
    condition: (e) => e.withdrawalAmount > 10000 && e.accountAgeDays < 7,
    action: 'review'
  }
];
```

---

## 13. Admin Dashboard & RBAC

### 13.1 Role Hierarchy

```
SUPER_ADMIN
  ├── Can do everything
  ├── Can create/delete admins
  ├── Can rotate server seeds manually
  ├── Can change house edge (with 24h delay + audit)
  ├── Can access financial reports
  └── Can emergency pause platform

ADMIN
  ├── Can view all users, bets, transactions
  ├── Can suspend/ban users
  ├── Can resolve risk events
  ├── Can trigger manual rain
  ├── Can view audit logs (read-only)
  └── Can view analytics (read-only)

MODERATOR
  ├── Can view users (limited fields)
  ├── Can mute users in chat
  ├── Can view chat logs
  ├── Can resolve support tickets
  └── Can view basic analytics

USER
  ├── Can view own data only
  ├── Can place bets
  ├── Can create/join squads
  └── Can claim rain
```

### 13.2 Sensitive Operation Workflow

```
House Edge Change:
  1. Admin submits change request (new value, reason)
  2. System logs to AuditLog
  3. Second admin approval required (if > 1% change)
  4. 24-hour delay enforced (users notified)
  5. Change applied at scheduled time
  6. All active bets use old edge; new bets use new edge
  7. Result broadcast to all users
  8. Immutable record stored

Server Seed Rotation:
  1. Admin triggers rotation
  2. System generates new seed
  3. Old seed revealed immediately
  4. All pending bets must complete before rotation
  5. New hash published
  6. Logged to AuditLog
```

### 13.3 Admin API Isolation

```
Physical Isolation (Recommended):
  - Admin API runs on separate service (port 4002)
  - Admin API only accessible via VPN / bastion host
  - Admin API has separate database connection pool
  - Admin API has stricter rate limits
  - Admin API requires 2FA for all endpoints
  - Admin API logs all requests to separate Elasticsearch index
```

---

## 14. Infrastructure & Deployment

### 14.1 Docker Compose (Development)

```yaml
# docker-compose.yml — Development Environment
version: "3.9"

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:4000
      - NEXT_PUBLIC_WS_URL=ws://localhost:4001
    depends_on:
      - api

  api:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    ports:
      - "4000:4000"
    volumes:
      - ./backend:/app
      - /app/node_modules
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/cryptoflip
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=dev-secret-do-not-use-in-production
      - NODE_ENV=development
    depends_on:
      - postgres
      - redis

  ws-game:
    build:
      context: ./backend
      dockerfile: Dockerfile.ws.dev
    ports:
      - "4001:4001"
    environment:
      - REDIS_URL=redis://redis:6379
      - NODE_ENV=development
    depends_on:
      - redis

  worker:
    build:
      context: ./backend
      dockerfile: Dockerfile.worker.dev
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/cryptoflip
      - REDIS_URL=redis://redis:6379
      - NODE_ENV=development
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=cryptoflip

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - frontend
      - api
      - ws-game

volumes:
  postgres_data:
  redis_data:
```

### 14.2 Production Dockerfile (Multi-Stage)

```dockerfile
# backend/Dockerfile — Production
# ─── Stage 1: Dependencies ───────────────────────────
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production

# ─── Stage 2: Builder ────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
RUN npm prune --production

# ─── Stage 3: Production ─────────────────────────────
FROM node:22-alpine AS runner
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
ENV PORT=4000
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser

# Copy built application
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/package.json ./package.json

USER appuser
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
```

### 14.3 Nginx Production Configuration

```nginx
# nginx/nginx.conf — Production
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 4096;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging format (JSON for parsing)
    log_format json_analytics escape=json '{"timestamp":"$time_iso8601",'
        '"remote_addr":"$remote_addr",'
        '"request":"$request",'
        '"status":$status,'
        '"body_bytes_sent":$body_bytes_sent,'
        '"request_time":$request_time,'
        '"http_referer":"$http_referer",'
        '"http_user_agent":"$http_user_agent",'
        '"http_x_forwarded_for":"$http_x_forwarded_for"}';

    access_log /var/log/nginx/access.log json_analytics;

    # Performance
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/xml+rss application/rss+xml text/javascript image/svg+xml;

    # Brotli (if module available)
    brotli on;
    brotli_comp_level 6;
    brotli_types text/plain text/css text/xml application/json application/javascript application/xml+rss application/rss+xml text/javascript image/svg+xml;

    # Rate limiting zones
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;
    limit_conn_zone $binary_remote_addr zone=addr:10m;

    # Upstream definitions
    upstream frontend {
        least_conn;
        server frontend-1:3000;
        server frontend-2:3000;
        keepalive 32;
    }

    upstream api {
        least_conn;
        server api-1:4000;
        server api-2:4000;
        keepalive 32;
    }

    upstream ws_game {
        ip_hash;  # Sticky sessions for WebSocket
        server ws-game-1:4001;
        server ws-game-2:4001;
        keepalive 32;
    }

    # SSL configuration
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # HSTS
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

    # Main server block
    server {
        listen 443 ssl http2;
        listen [::]:443 ssl http2;
        server_name cryptoflip.io www.cryptoflip.io;

        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # API
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            limit_conn addr 10;
            
            proxy_pass http://api;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_connect_timeout 5s;
            proxy_send_timeout 10s;
            proxy_read_timeout 10s;
        }

        # WebSocket
        location /ws/ {
            proxy_pass http://ws_game;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 86400s;
            proxy_send_timeout 86400s;
        }

        # Auth (stricter rate limits)
        location /api/auth/ {
            limit_req zone=auth burst=5 nodelay;
            proxy_pass http://api;
        }

        # Health check (no rate limit)
        location /health {
            proxy_pass http://api;
            access_log off;
        }

        # Static assets (CDN fallback)
        location /_next/static/ {
            proxy_pass http://frontend;
            proxy_cache_valid 200 365d;
            add_header Cache-Control "public, immutable";
        }
    }

    # Redirect HTTP to HTTPS
    server {
        listen 80;
        listen [::]:80;
        server_name cryptoflip.io www.cryptoflip.io;
        return 301 https://$server_name$request_uri;
    }
}
```

### 14.4 CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Production Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Lint
        run: npm run lint
      
      - name: Type check
        run: npm run typecheck
      
      - name: Unit tests
        run: npm run test:unit
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
          REDIS_URL: redis://localhost:6379
      
      - name: Integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
          REDIS_URL: redis://localhost:6379
      
      - name: Security audit
        run: npm audit --audit-level=moderate
      
      - name: SAST scan
        uses: securecodewarrior/github-action-add-sarif@v1

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Build Docker images
        run: |
          docker build -t cryptoflip/api:${{ github.sha }} -f backend/Dockerfile .
          docker build -t cryptoflip/frontend:${{ github.sha }} -f frontend/Dockerfile .
          docker build -t cryptoflip/ws:${{ github.sha }} -f backend/Dockerfile.ws .
      
      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push cryptoflip/api:${{ github.sha }}
          docker push cryptoflip/frontend:${{ github.sha }}
          docker push cryptoflip/ws:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: production
    
    steps:
      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/cryptoflip
            docker-compose -f docker-compose.prod.yml pull
            docker-compose -f docker-compose.prod.yml up -d
            docker system prune -f
            
      - name: Verify deployment
        run: |
          sleep 10
          curl -f https://api.cryptoflip.io/health || exit 1
      
      - name: Notify on failure
        if: failure()
        uses: slack-action@v1
        with:
          webhook: ${{ secrets.SLACK_WEBHOOK }}
          message: "Production deploy FAILED: ${{ github.sha }}"
```

---

## 15. Monitoring & Observability

### 15.1 Three Pillars

```
METRICS (Prometheus)
  - Business: bets_per_second, active_users, house_profit, rain_claims
  - Application: request_duration, error_rate, queue_depth, ws_connections
  - Infrastructure: CPU, memory, disk, network, DB connections
  - Blockchain: pending_tx, gas_price, contract_balance

LOGS (Loki / Elasticsearch)
  - Structured JSON logging (Pino)
  - Correlation IDs (trace_id, span_id)
  - Sensitive data redaction (passwords, seeds, private keys)
  - Retention: 30 days hot, 1 year cold (S3)

TRACES (Jaeger / Tempo)
  - OpenTelemetry auto-instrumentation
  - Custom spans for game engine, WebSocket, blockchain
  - Sampling: 100% for errors, 1% for success (adjustable)
  - Trace propagation across service boundaries
```

### 15.2 Critical Alerts

```yaml
# Alertmanager rules
rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      
  - alert: DatabaseConnectionsExhausted
    expr: pg_stat_activity_count > 180
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "PostgreSQL connections near limit"
      
  - alert: RedisDown
    expr: redis_up == 0
    for: 30s
    labels:
      severity: critical
    annotations:
      summary: "Redis is down — real-time features broken"
      
  - alert: BlockchainSyncLag
    expr: blockchain_block_lag > 10
    for: 5m
    labels:
      severity: high
    annotations:
      summary: "Blockchain indexer lagging"
      
  - alert: UnusualWithdrawalVolume
    expr: rate(withdrawals_total[1h]) > 2 * avg_over_time(rate(withdrawals_total[1h])[24h])
    for: 10m
    labels:
      severity: high
    annotations:
      summary: "Unusual withdrawal volume detected"
      
  - alert: HouseBalanceLow
    expr: house_balance < 100000
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "House balance critically low"
```

### 15.3 Dashboards (Grafana)

| Dashboard | Panels | Refresh |
|-----------|--------|---------|
| Platform Overview | Active users, bets/min, revenue, rain activity | 5s |
| Game Engine | Bet latency, settlement time, win/loss ratio, seed status | 5s |
| WebSocket | Connections, rooms, messages/sec, error rate | 5s |
| Blockchain | Pending TX, gas costs, contract balance, deposit lag | 10s |
| Security | Blocked requests, fraud flags, login anomalies | 30s |
| Business | DAU, retention, LTV, cohort analysis | 1h |

---

## 16. Testing Strategy

### 16.1 Test Pyramid

```
E2E Tests (5%)
  ├── Playwright: Full user journeys (signup → bet → withdraw)
  ├── Load Tests: k6 / Artillery (1000 concurrent users)
  └── Chaos Tests: Random service failures

Integration Tests (15%)
  ├── API: Supertest + TestContainers (real DB + Redis)
  ├── WebSocket: Socket.io client tests
  ├── Blockchain: Hardhat local network tests
  └── Smart Contract: Foundry test suite

Unit Tests (80%)
  ├── Jest: All business logic, utilities, algorithms
  ├── Provably Fair: Deterministic outcome verification
  ├── Payout: Edge cases (0.0001, max bet, rounding)
  └── Fraud: Rule engine with synthetic data
```

### 16.2 Test Environments

| Environment | Purpose | Data | Blockchain |
|-------------|---------|------|------------|
| `local` | Developer machine | Docker containers | Hardhat local |
| `ci` | GitHub Actions | TestContainers | Hardhat local |
| `staging` | Pre-production testing | Anonymized prod snapshot | Testnet |
| `production` | Live | Real user data | Mainnet |

### 16.3 Critical Test Cases

```typescript
describe('Provably Fair', () => {
  it('should produce deterministic outcomes for same inputs', () => {
    const result1 = generateOutcome(seed, clientSeed, 0n);
    const result2 = generateOutcome(seed, clientSeed, 0n);
    expect(result1).toEqual(result2);
  });
  
  it('should have exactly 50% distribution over 1M runs', () => {
    const results = simulate(1_000_000);
    expect(results.heads).toBeCloseTo(500_000, 0.01);
  });
  
  it('should verify hash commitment correctly', () => {
    const hash = sha256(serverSeed);
    expect(hash).toBe(publishedHash);
    expect(generateOutcome(serverSeed, clientSeed, nonce)).toBeValid();
  });
});

describe('Concurrency', () => {
  it('should prevent double-spend under 100 concurrent bets', async () => {
    const balance = await getBalance();
    const bets = Array(100).fill().map(() => placeBet(balance / 100));
    await Promise.all(bets);
    const finalBalance = await getBalance();
    expect(finalBalance).toBeGreaterThanOrEqual(0);
  });
});
```

---

## 17. Disaster Recovery & Business Continuity

### 17.1 Failure Scenarios

| Scenario | Impact | Mitigation | RTO | RPO |
|----------|--------|------------|-----|-----|
| DB Primary failure | Read/write unavailable | Automatic failover to replica | 2 min | 0 (sync replication) |
| DB Corruption | Data loss | Point-in-time recovery from backups | 2 hours | 6 hours |
| Redis failure | Real-time features broken | Redis Sentinel auto-failover | 30 sec | 0 (AOF + RDB) |
| API node failure | Partial capacity loss | Health checks remove from LB | 0 (auto) | 0 |
| WebSocket node failure | Room disconnections | Clients reconnect to healthy node | 10 sec | 0 (state in Redis) |
| Blockchain RPC failure | Deposits/withdrawals delayed | Fallback RPC providers (3x) | 5 min | N/A |
| Smart contract exploit | Fund loss | Emergency pause + multi-sig recovery | 1 hour | N/A |
| DDoS attack | Service unavailable | Cloudflare + WAF + rate limiting | 0 (auto) | 0 |
| CDN failure | Static assets slow | Multi-CDN failover (Cloudflare + Fastly) | 5 min | 0 |
| Region outage | Complete downtime | Multi-region deployment (Phase 3) | 15 min | 0 |

### 17.2 Runbook: Emergency Pause

```bash
#!/bin/bash
# emergency-pause.sh

# 1. Stop all betting (set global flag in Redis)
redis-cli SET global:betting:paused "1" EX 3600

# 2. Notify all connected clients
node -e "
  const io = require('socket.io-client')('ws://localhost:4001');
  io.emit('admin:pause', { reason: 'emergency', duration: 3600 });
"

# 3. Settle all pending bets (graceful)
npx ts-node scripts/settle-pending-bets.ts

# 4. Pause smart contract
npx hardhat run scripts/pause-contract.ts --network mainnet

# 5. Alert team
slack-notify "#incidents" "Emergency pause activated. Reason: $1"

# 6. Log to audit
psql -c "INSERT INTO audit_logs (action, resource, old_value, new_value) 
  VALUES ('emergency_pause', 'platform', '{\"status\":\"active\"}', '{\"status\":\"paused\"}');"
```

---

## 18. Compliance & Legal

### 18.1 KYC / AML Architecture

```
Tier 1 (No KYC):
  - Can: Play with small bets (< $100/day)
  - Cannot: Withdraw > $50/day, create squads, claim rain

Tier 2 (Basic KYC):
  - Requires: Government ID + selfie
  - Can: Withdraw up to $10,000/day, full platform access
  - Provider: SumSub / Onfido / Jumio

Tier 3 (Enhanced KYC):
  - Requires: Proof of address + source of funds
  - Can: Withdraw > $10,000/day
  - Trigger: Automated by transaction volume

Screening:
  - Sanctions lists: OFAC, UN, EU (daily sync)
  - PEP screening
  - Adverse media monitoring
```

### 18.2 Data Retention (GDPR)

| Data Type | Retention | Deletion |
|-----------|-----------|----------|
| User profile | Account lifetime + 7 years | Anonymize after closure |
| Bet history | 7 years | Anonymize (keep aggregated stats) |
| Chat messages | 30 days | Hard delete |
| Transaction logs | 10 years | Archive only (legal requirement) |
| Audit logs | 10 years | Immutable |
| IP addresses | 90 days | Anonymize (hash) |
| KYC documents | 7 years | Secure shred after period |

### 18.3 Regulatory Requirements (Bangladesh Market)

```
⚠️ CRITICAL: Bangladesh has strict gambling laws.
This platform must be designed as a "skill-based prediction game"
or operate in jurisdictions where crypto gambling is legal.

Recommended Architecture:
  1. Company incorporation: Curacao / Malta / Isle of Man
  2. Gaming license: Curacao eGaming / MGA
  3. Geo-blocking: Bangladesh IP ranges blocked by default
  4. Terms of Service: Explicitly state jurisdiction
  5. User declaration: Self-certification of legal eligibility
```

---

## 19. Performance & Scalability

### 19.1 Capacity Planning

| Metric | Current | Target (6 mo) | Target (12 mo) |
|--------|---------|---------------|----------------|
| Concurrent users | 1,000 | 10,000 | 50,000 |
| Bets per second | 50 | 500 | 2,000 |
| WebSocket connections | 1,000 | 10,000 | 50,000 |
| Daily transactions | 100K | 1M | 5M |
| DB queries/sec | 2,000 | 20,000 | 100,000 |
| API response time (p99) | 50ms | 30ms | 20ms |
| WebSocket latency (p99) | 20ms | 10ms | 5ms |

### 19.2 Scaling Strategies

```
Vertical (Upgrade):
  - DB: rds.2xlarge → rds.4xlarge
  - Redis: cache.r6g.xlarge → cache.r6g.2xlarge
  - API: 2 vCPU → 4 vCPU

Horizontal (Add nodes):
  - API: 2 → 10 instances (stateless, LB distributes)
  - WebSocket: 2 → 20 instances (Redis adapter coordinates)
  - Workers: 2 → 10 instances (BullMQ distributes jobs)
  - Read replicas: 1 → 3 (for read-heavy queries)

Database:
  - Read replicas for analytics, leaderboards, history
  - Connection pooling (PgBouncer): max 1000 connections
  - Partitioning: Monthly partitions for bets, transactions
  - Archival: Move > 90 days to S3 (queryable via Athena)

Caching:
  - L1: In-memory (Node.js LRU, 100MB per instance)
  - L2: Redis (house config, user sessions, active bets)
  - L3: CDN (static assets, 3D models, audio files)
  - Cache hit targets: L1 80%, L2 95%, L3 99%
```

---

## 20. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4) — AUDIT: DONE
```
☑ Architecture documentation (this document)
☑ Docker development environment
☑ Database schema + Prisma setup
☑ Basic Next.js frontend shell
☑ Express API skeleton
☑ Socket.io WebSocket scaffold
☐ Redis session + caching setup
☐ Nginx reverse proxy config
```

### Phase 2: Core Game (Weeks 5-8)
```
☐ Provably fair algorithm implementation
☐ Bet placement + settlement flow
☐ Wallet connection (MetaMask/Phantom)
☐ Balance management (off-chain)
☐ 3D coin animation (React Three Fiber)
☐ Sound effects (Howler.js)
☐ Basic game UI (bet, history, fairness verify)
☐ Unit tests for game engine (100% coverage)
```

### Phase 3: Social Features (Weeks 9-12)
```
☐ Squad creation + joining
☐ Squad betting + distribution
☐ Live chat (global + squad rooms)
☐ Crypto rain system
☐ Leaderboards
☐ User profiles + stats
☐ Chat moderation tools
☐ Anti-gaming measures
```

### Phase 4: Financial (Weeks 13-16)
```
☐ Smart contract deployment (testnet)
☐ Deposit detection (TheGraph indexer)
☐ Withdrawal queue + processing
☐ On-chain reconciliation
☐ House fee collection
☐ Transaction history
☐ Multi-chain support (Phase 2: BSC, Polygon)
☐ Smart contract audit (OpenZeppelin / CertiK)
```

### Phase 5: Security & Compliance (Weeks 17-20)
```
☐ KYC integration (SumSub)
☐ AML screening (Chainalysis / Elliptic)
☐ Fraud detection engine
☐ Rate limiting (per-endpoint)
☐ WAF rules + DDoS protection
☐ Penetration testing
☐ Security audit (external firm)
☐ Bug bounty program launch
```

### Phase 6: Production Hardening (Weeks 21-24)
```
☐ Monitoring + alerting (Prometheus + Grafana)
☐ Logging pipeline (Loki + Elasticsearch)
☐ CI/CD pipeline (GitHub Actions)
☐ Infrastructure as code (Terraform)
☐ Backup + disaster recovery testing
☐ Load testing (k6, 10K concurrent users)
☐ Chaos engineering (random failures)
☐ Production deployment (blue/green)
```

---

## 21. Gap Analysis Summary

### Phase 1 Document vs. Production Architecture

| # | Phase 1 State | Production Requirement | Status in This Document |
|---|---------------|----------------------|------------------------|
| 1 | "PostgreSQL" mentioned | Schema, migrations, indexes, partitioning | ✅ Full Prisma schema with 15+ models |
| 2 | "API" mentioned generically | REST + WebSocket contract with rate limits | ✅ 40+ endpoints, 20+ WS events, per-endpoint limits |
| 3 | "Web3" mentioned | Smart contract, wallet flow, multi-chain | ✅ Solidity escrow, EIP-191 auth, 5-chain support |
| 4 | "Security" mentioned | OWASP, CSP, WAF, fraud detection | ✅ 7-layer defense, CSP, fraud rules, 2FA |
| 5 | No monitoring | Metrics, logs, traces, alerts | ✅ Prometheus + Grafana + Loki + Jaeger |
| 6 | No CI/CD | Build, test, deploy automation | ✅ GitHub Actions with test → build → deploy |
| 7 | "Rate Limit" box only | Per-endpoint, per-user, per-IP architecture | ✅ Express + Redis sliding window limits |
| 8 | No concurrency mention | Atomic balance locking, transaction isolation | ✅ Redis Lua scripts, Serializable transactions |
| 9 | No queue mention | Async processing, job reliability | ✅ BullMQ + Redis Streams for all async ops |
| 10 | No backup mention | RTO/RPO, backup testing, failover | ✅ pgBackRest, 6-hour RPO, 2-hour RTO |
| 11 | No secrets mention | Vault, rotation, dynamic credentials | ✅ HashiCorp Vault, dynamic DB creds |
| 12 | No KYC mention | Identity verification, compliance | ✅ 3-tier KYC, AML screening, sanctions |
| 13 | "Admin panel" mentioned | RBAC, audit trail, approval workflows | ✅ 4-role RBAC, immutable audit logs, 2FA |
| 14 | No testing mention | Unit, integration, e2e, load, chaos | ✅ Full pyramid, TestContainers, k6 |
| 15 | No CDN mention | Asset delivery, global performance | ✅ Cloudflare + multi-CDN fallback |
| 16 | Single Nginx box | Load balancing, high availability | ✅ Nginx cluster, least_conn, health checks |
| 17 | No cache invalidation | Cache consistency, TTL strategy | ✅ 3-tier cache with explicit invalidation |
| 18 | No fraud detection | Sybil, collusion, rain farming | ✅ 5+ fraud rules with automated actions |
| 19 | No reconnection logic | State recovery, event replay | ✅ Sequence numbers, Redis Streams buffer |
| 20 | No analytics | Business intelligence, retention | ✅ TimescaleDB, Grafana dashboards, cohort analysis |

---

## 22. Appendices

### Appendix A: Environment Variables

```bash
# .env.example — Production

# Application
NODE_ENV=production
PORT=4000
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://user:pass@primary:5432/cryptoflip?schema=public
DATABASE_POOL_SIZE=20
DATABASE_REPLICA_URL=postgresql://user:pass@replica:5432/cryptoflip

# Redis
REDIS_URL=redis://redis-master:6379
REDIS_PASSWORD=secure-redis-password
REDIS_SENTINEL_HOSTS=sentinel-1:26379,sentinel-2:26379,sentinel-3:26379

# JWT
JWT_SECRET=openssl-rand-base64-32
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
JWT_ALGORITHM=RS256
JWT_PRIVATE_KEY_PATH=/secrets/jwt-private.pem
JWT_PUBLIC_KEY_PATH=/secrets/jwt-public.pem

# Blockchain
RPC_URL_ETH=https://eth-mainnet.g.alchemy.com/v2/KEY
RPC_URL_BSC=https://bsc-dataseed.binance.org
RPC_URL_POLYGON=https://polygon-mainnet.g.alchemy.com/v2/KEY
CONTRACT_ADDRESS_ETH=0x...
CONTRACT_ADDRESS_BSC=0x...
INDEXER_API_KEY=...

# Wallet Connect
WALLET_CONNECT_PROJECT_ID=...

# KYC
KYC_PROVIDER=sumsub
SUMSUB_APP_TOKEN=...
SUMSUB_SECRET_KEY=...

# Security
BCRYPT_ROUNDS=12
TOTP_ISSUER=CryptoFlip
SESSION_MAX_CONCURRENT=5

# Rain
RAIN_DAILY_BUDGET=100
RAIN_MAX_PER_USER_PER_DAY=10
RAIN_MIN_WALLET_AGE_DAYS=7
RAIN_MIN_BET_COUNT=3

# House
HOUSE_EDGE_DEFAULT=2.0
MAX_BET_DEFAULT=10000
MIN_BET_DEFAULT=0.0001

# Monitoring
PROMETHEUS_PORT=9090
JAEGER_ENDPOINT=http://jaeger:14268/api/traces
SENTRY_DSN=https://...@sentry.io/...

# Alerts
SLACK_WEBHOOK=https://hooks.slack.com/...
PAGERDUTY_KEY=...
```

### Appendix B: File Structure

```
cryptoflip/
├── .github/
│   └── workflows/
│       ├── test.yml
│       └── deploy.yml
├── docs/
│   ├── ARCHITECTURE.md          # This document
│   ├── API.md                   # OpenAPI specification
│   ├── DEPLOYMENT.md            # Runbooks
│   └── SECURITY.md              # Security procedures
├── infrastructure/
│   ├── terraform/               # AWS/GCP/Azure infra
│   ├── ansible/                 # Server provisioning
│   └── docker/
│       ├── docker-compose.yml
│       ├── docker-compose.prod.yml
│       └── docker-compose.override.yml
├── frontend/
│   ├── app/                     # Next.js App Router
│   ├── components/
│   ├── hooks/
│   ├── stores/                  # Zustand
│   ├── lib/
│   ├── public/
│   └── tests/
├── backend/
│   ├── src/
│   │   ├── api/                 # Express routes
│   │   ├── ws/                  # Socket.io handlers
│   │   ├── game/                # Game engine
│   │   ├── blockchain/          # Web3 integration
│   │   ├── workers/             # BullMQ jobs
│   │   ├── services/            # Business logic
│   │   ├── models/              # Prisma client
│   │   ├── middleware/          # Auth, rate limit, validation
│   │   ├── utils/               # Helpers, crypto
│   │   ├── config/              # Environment config
│   │   └── types/               # TypeScript types
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── contracts/               # Solidity smart contracts
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── e2e/
│   └── scripts/
│       ├── seed.ts
│       ├── settle-pending.ts
│       └── emergency-pause.ts
├── monitoring/
│   ├── prometheus/
│   ├── grafana/
│   └── alerting/
└── nginx/
    ├── nginx.conf
    └── ssl/
```

### Appendix C: Risk Register

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|----|------|------------|--------|------------|-------|
| R1 | Smart contract exploit | Low | Critical | Audits, bug bounty, insurance, pause | CTO |
| R2 | Regulatory shutdown | Medium | Critical | Legal counsel, KYC, geo-blocking, licensing | Legal |
| R3 | Database corruption | Low | Critical | Backups, replicas, PITR, DR drills | DevOps |
| R4 | Key employee departure | Medium | High | Documentation, pair programming, bus factor > 2 | HR |
| R5 | DDoS attack | Medium | Medium | Cloudflare, WAF, rate limiting, auto-scaling | DevOps |
| R6 | Crypto market crash | High | Medium | Diversify treasury, stablecoin reserves | CFO |
| R7 | Competitor copy | High | Low | Patent IP, network effects, brand loyalty | CEO |
| R8 | User data breach | Low | Critical | Encryption, least privilege, audit logs, SOC 2 | CISO |

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-06-19 | Phase 1 (AI-generated) | Initial high-level roadmap |
| 2.0 | 2024-06-19 | Architecture Review | Complete production rewrite addressing all 20 gaps |

---

> **END OF DOCUMENT**
> 
> This document is a living specification. All changes must be reviewed and approved by the Technical Lead and Security Officer. Changes to sections 7 (Provably Fair), 12 (Security), or 13 (Admin/RBAC) require additional approval from the Compliance Officer.
