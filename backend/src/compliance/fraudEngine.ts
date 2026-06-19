import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { Redis } from "ioredis";
import { config } from "@config";
import { logger } from "@utils/logger";

const prisma = new PrismaClient();
const redis = new Redis(config.REDIS_URL);

// ─── FRAUD RULES ────────────────────────────────────────

interface FraudRule {
  id: string;
  name: string;
  severity: "low" | "medium" | "high" | "critical";
  enabled: boolean;
  evaluate: (context: FraudContext) => Promise<boolean>;
  action: "flag" | "block" | "suspend" | "review";
}

interface FraudContext {
  userId: string;
  ipAddress: string;
  userAgent: string;
  walletAddress: string;
  chainId: number;
  betAmount?: Decimal;
  betCount?: number;
  winCount?: number;
  lossCount?: number;
  totalWagered?: Decimal;
  totalWon?: Decimal;
  squadCount?: number;
  rainClaimsToday?: number;
  timestamp: Date;
}

interface RiskEvent {
  userId: string;
  riskType: string;
  severity: string;
  description: string;
  evidence: Record<string, unknown>;
  action: string;
}

// ─── RULE DEFINITIONS ─────────────────────────────────

const FRAUD_RULES: FraudRule[] = [
  // 1. High bet velocity (bot / script)
  {
    id: "velocity_1",
    name: "High Bet Velocity",
    severity: "medium",
    enabled: true,
    action: "flag",
    evaluate: async (ctx) => {
      const key = `bets:${ctx.userId}:count`;
      const count = await redis.incr(key);
      await redis.expire(key, 60); // 1 minute window
      return count > 20; // >20 bets/min
    },
  },

  // 2. Multi-account from same IP
  {
    id: "sybil_1",
    name: "Multi-Account from Same IP",
    severity: "high",
    enabled: true,
    action: "review",
    evaluate: async (ctx) => {
      const key = `ip:${ctx.ipAddress}:accounts`;
      const accounts = await redis.smembers(key);
      await redis.sadd(key, ctx.userId);
      await redis.expire(key, 3600); // 1 hour window
      return accounts.length > 4; // >5 accounts from same IP
    },
  },

  // 3. Rain farming (no bets, only claims)
  {
    id: "rain_farm_1",
    name: "Rain Farming Pattern",
    severity: "medium",
    enabled: true,
    action: "block",
    evaluate: async (ctx) => {
      if (ctx.rainClaimsToday === undefined) return false;
      return ctx.rainClaimsToday > 50 && (ctx.betCount ?? 0) < 3;
    },
  },

  // 4. Impossible win rate (collusion / exploitation)
  {
    id: "collusion_1",
    name: "Impossible Win Rate",
    severity: "high",
    enabled: true,
    action: "review",
    evaluate: async (ctx) => {
      if (!ctx.betCount || ctx.betCount < 20) return false;
      const winRate = (ctx.winCount ?? 0) / ctx.betCount;
      return winRate > 0.85; // >85% win rate over 20+ bets
    },
  },

  // 5. Large withdrawal after short account age
  {
    id: "withdrawal_1",
    name: "Suspicious Withdrawal Pattern",
    severity: "medium",
    enabled: true,
    action: "review",
    evaluate: async (ctx) => {
      const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { createdAt: true },
      });
      if (!user) return false;
      const accountAgeDays = (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      const largeWithdrawal = (ctx.betAmount ?? new Decimal(0)).greaterThan(10000);
      return largeWithdrawal && accountAgeDays < 7;
    },
  },

  // 6. Rapid squad creation (farming)
  {
    id: "squad_farm_1",
    name: "Rapid Squad Creation",
    severity: "medium",
    enabled: true,
    action: "flag",
    evaluate: async (ctx) => {
      const key = `squads:${ctx.userId}:created`;
      const count = await redis.incr(key);
      await redis.expire(key, 3600); // 1 hour window
      return count > 10; // >10 squads/hour
    },
  },

  // 7. IP geolocation mismatch
  {
    id: "geo_1",
    name: "Geolocation Anomaly",
    severity: "low",
    enabled: true,
    action: "flag",
    evaluate: async (ctx) => {
      const key = `geo:${ctx.userId}:countries`;
      const countries = await redis.smembers(key);
      await redis.sadd(key, ctx.ipAddress); // Simplified: using IP as proxy
      await redis.expire(key, 86400); // 24 hour window
      return countries.length > 2; // Logins from >3 countries in 24h
    },
  },

  // 8. Negative PnL reversal (wash trading)
  {
    id: "wash_1",
    name: "Wash Trading Pattern",
    severity: "high",
    enabled: true,
    action: "review",
    evaluate: async (ctx) => {
      if (!ctx.totalWagered || !ctx.totalWon) return false;
      const pnl = ctx.totalWon.minus(ctx.totalWagered);
      return pnl.lessThan(0) && (ctx.betCount ?? 0) > 100; // Heavy losses but still betting
    },
  },
];

// ─── RISK SCORING ENGINE ──────────────────────────────

const SEVERITY_WEIGHTS = {
  low: 1,
  medium: 3,
  high: 10,
  critical: 50,
};

const ACTION_THRESHOLDS = {
  flag: 5,    // Risk score >= 5 → flag
  block: 20,  // Risk score >= 20 → block
  suspend: 50, // Risk score >= 50 → suspend
  review: 100, // Risk score >= 100 → manual review
};

export async function evaluateRisk(userId: string, context: Partial<FraudContext>): Promise<{
  score: number;
  triggered: RiskEvent[];
  action: string;
}> {
  const fullContext: FraudContext = {
    userId,
    ipAddress: context.ipAddress ?? "unknown",
    userAgent: context.userAgent ?? "unknown",
    walletAddress: context.walletAddress ?? "unknown",
    chainId: context.chainId ?? 1,
    betAmount: context.betAmount,
    betCount: context.betCount,
    winCount: context.winCount,
    lossCount: context.lossCount,
    totalWagered: context.totalWagered,
    totalWon: context.totalWon,
    squadCount: context.squadCount,
    rainClaimsToday: context.rainClaimsToday,
    timestamp: new Date(),
  };

  let score = 0;
  const triggered: RiskEvent[] = [];

  for (const rule of FRAUD_RULES) {
    if (!rule.enabled) continue;

    try {
      const triggered = await rule.evaluate(fullContext);
      if (triggered) {
        const weight = SEVERITY_WEIGHTS[rule.severity];
        score += weight;

        const event: RiskEvent = {
          userId,
          riskType: rule.id,
          severity: rule.severity,
          description: rule.name,
          evidence: { rule: rule.name, score: weight },
          action: rule.action,
        };

        triggered.push(event);
        logger.warn({ msg: "Fraud rule triggered", rule: rule.id, userId, severity: rule.severity });
      }
    } catch (err) {
      logger.error({ msg: "Fraud rule evaluation failed", rule: rule.id, error: err });
    }
  }

  // Determine action based on score
  let action = "none";
  if (score >= ACTION_THRESHOLDS.review) action = "review";
  else if (score >= ACTION_THRESHOLDS.suspend) action = "suspend";
  else if (score >= ACTION_THRESHOLDS.block) action = "block";
  else if (score >= ACTION_THRESHOLDS.flag) action = "flag";

  // Persist risk events to DB
  if (triggered.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const event of triggered) {
        await tx.riskEvent.create({
          data: {
            userId: event.userId,
            riskType: event.riskType,
            severity: event.severity,
            description: event.description,
            evidence: event.evidence,
            status: action === "review" ? "open" : "resolved",
            resolvedBy: action !== "review" ? "system" : null,
            resolvedAt: action !== "review" ? new Date() : null,
          },
        });
      }
    });
  }

  // Cache risk score for quick lookups
  await redis.setex(`risk:${userId}`, 3600, JSON.stringify({ score, action, triggered: triggered.length }));

  return { score, triggered, action };
}

// ─── CONTEXT BUILDER ──────────────────────────────────

export async function buildFraudContext(userId: string): Promise<FraudContext> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      wallets: true,
      bets: { where: { status: "COMPLETED" } },
      _count: { select: { bets: true, squadMembers: true, rainClaims: true } },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const wallet = user.wallets[0];
  const betCount = user._count.bets;
  const winCount = user.bets.filter((b) => b.payoutAmount && b.payoutAmount.greaterThan(0)).length;
  const lossCount = betCount - winCount;
  const totalWagered = user.bets.reduce((sum, b) => sum.plus(b.amount), new Decimal(0));
  const totalWon = user.bets.reduce((sum, b) => sum.plus(b.payoutAmount ?? 0), new Decimal(0));

  // Rain claims today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rainClaimsToday = await prisma.rainClaim.count({
    where: { userId, claimedAt: { gte: today } },
  });

  return {
    userId,
    ipAddress: user.ipAddress ?? "unknown",
    userAgent: "unknown",
    walletAddress: wallet?.address ?? "unknown",
    chainId: wallet?.chainId ?? 1,
    betCount,
    winCount,
    lossCount,
    totalWagered,
    totalWon,
    squadCount: user._count.squadMembers,
    rainClaimsToday,
    timestamp: new Date(),
  };
}

export { FRAUD_RULES, SEVERITY_WEIGHTS, ACTION_THRESHOLDS };
export type { FraudContext, FraudRule, RiskEvent };
