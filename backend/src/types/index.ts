/**
 * Core TypeScript types and interfaces for CryptoFlip
 */

export type UserRole = "USER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN";
export type UserStatus = "ACTIVE" | "SUSPENDED" | "BANNED" | "PENDING_KYC";
export type WalletType = "METAMASK" | "PHANTOM" | "WALLET_CONNECT" | "COINBASE";
export type BetStatus = "PENDING" | "CONFIRMED" | "PROCESSING" | "COMPLETED" | "CANCELLED" | "DISPUTED";
export type GameOutcome = "HEADS" | "TAILS";
export type SquadStatus = "FORMING" | "READY" | "ACTIVE" | "DISSOLVED";
export type RainStatus = "SCHEDULED" | "ACTIVE" | "CLAIMED" | "EXPIRED";
export type TransactionType = "DEPOSIT" | "WITHDRAWAL" | "BET_PLACED" | "BET_WON" | "BET_LOST" | "SQUAD_PAYOUT" | "RAIN_CLAIM" | "HOUSE_FEE" | "REFUND";
export type TransactionStatus = "PENDING" | "CONFIRMED" | "FAILED" | "REVERTED";

export interface HealthCheck {
  status: "ok" | "degraded" | "down";
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    database: "connected" | "disconnected";
    redis: "connected" | "disconnected";
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface PaginatedQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface AuthPayload {
  userId: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export interface BetPlacementRequest {
  amount: string;
  prediction: GameOutcome;
  clientSeed: string;
  walletId: string;
}

export interface BetResultResponse {
  betId: string;
  outcome: GameOutcome;
  won: boolean;
  payout: string;
  resultHash: string;
  serverSeed: string;
  nonce: number;
}

export interface ProvablyFairVerification {
  serverSeedHash: string;
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  resultHash: string;
  outcome: GameOutcome;
  verificationSteps: string[];
}

export interface SquadCreationRequest {
  name: string;
  targetAmount: string;
  predictedOutcome: GameOutcome;
  maxMembers?: number;
}

export interface RainTriggerEvent {
  type: "win_streak" | "milestone" | "admin" | "scheduled";
  budget: string;
  perClaimAmount: string;
  maxClaims: number;
  durationSeconds: number;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  content: string;
  timestamp: string;
  isDeleted?: boolean;
}

export interface FraudRule {
  id: string;
  name: string;
  severity: "low" | "medium" | "high" | "critical";
  condition: string;
  action: "flag" | "block" | "suspend" | "review";
}

export interface AuditLogEntry {
  id: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}
