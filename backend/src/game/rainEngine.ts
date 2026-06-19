import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { Redis } from "ioredis";
import { config } from "@config";
import { AppError } from "@middleware/errorHandler";
import { logger } from "@utils/logger";

const prisma = new PrismaClient();
const redis = new Redis(config.REDIS_URL);

interface RainTriggerInput {
  type: "win_streak" | "milestone" | "admin" | "scheduled";
  triggerUserId?: string;
  streakCount?: number;
  budget: Decimal;
  perClaimAmount: Decimal;
  maxClaims: number;
  durationSeconds: number;
}

/**
 * Triggers a new rain event.
 */
export async function triggerRain(input: RainTriggerInput) {
  // Check daily budget
  const dailySpentKey = "rain:daily:spent";
  const dailyBudget = new Decimal(config.RAIN_DAILY_BUDGET);
  const dailySpent = await redis.get(dailySpentKey);

  const currentSpent = dailySpent ? new Decimal(dailySpent) : new Decimal(0);
  if (currentSpent.plus(input.budget).greaterThan(dailyBudget)) {
    throw new AppError("Daily rain budget exhausted", 429, "RAIN_BUDGET_EXHAUSTED");
  }

  // Atomically reserve budget
  await redis.incrbyfloat(dailySpentKey, input.budget.toNumber());
  await redis.expire(dailySpentKey, 86400); // Reset after 24 hours

  // Create rain event
  const rain = await prisma.rainEvent.create({
    data: {
      triggerType: input.type,
      triggerUserId: input.triggerUserId,
      streakCount: input.streakCount,
      totalBudget: input.budget,
      perClaimAmount: input.perClaimAmount,
      maxClaims: input.maxClaims,
      status: "ACTIVE",
      startedAt: new Date(),
    },
  });

  // Initialize remaining claims counter
  await redis.set(`rain:${rain.id}:remaining`, input.maxClaims, "EX", input.durationSeconds);

  // Schedule auto-close
  setTimeout(async () => {
    await prisma.rainEvent.update({
      where: { id: rain.id },
      data: { status: "EXPIRED", endedAt: new Date() },
    });
    logger.info({ msg: "Rain auto-closed", rainId: rain.id });
  }, input.durationSeconds * 1000);

  logger.info({
    msg: "Rain triggered",
    rainId: rain.id,
    type: input.type,
    budget: input.budget.toString(),
  });

  return rain;
}

/**
 * Claims a rain reward.
 */
export async function claimRain(userId: string, rainId: string, ipAddress: string) {
  // 1. Validate rain is active
  const rain = await prisma.rainEvent.findUnique({
    where: { id: rainId },
  });

  if (!rain) {
    throw new AppError("Rain not found", 404, "RAIN_NOT_FOUND");
  }
  if (rain.status !== "ACTIVE") {
    throw new AppError("Rain is no longer active", 400, "RAIN_INACTIVE");
  }

  // 2. Check user eligibility (anti-farming)
  const wallet = await prisma.wallet.findFirst({
    where: { userId, isPrimary: true },
  });
  if (!wallet) {
    throw new AppError("No primary wallet found", 400, "NO_WALLET");
  }

  const walletAge = wallet.createdAt
    ? Math.floor((Date.now() - wallet.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  if (walletAge < parseInt(config.RAIN_MIN_WALLET_AGE_DAYS)) {
    throw new AppError(`Wallet must be at least ${config.RAIN_MIN_WALLET_AGE_DAYS} days old`, 400, "WALLET_TOO_NEW");
  }

  const betCount = await prisma.bet.count({ where: { userId } });
  if (betCount < parseInt(config.RAIN_MIN_BET_COUNT)) {
    throw new AppError(`Must have at least ${config.RAIN_MIN_BET_COUNT} bets`, 400, "NOT_ENOUGH_BETS");
  }

  // 3. Atomic claim (prevent double-claim)
  const claimKey = `rain:${rainId}:claim:${userId}`;
  const alreadyClaimed = await redis.set(claimKey, "1", "NX", "EX", 3600);
  if (!alreadyClaimed) {
    throw new AppError("Already claimed this rain", 400, "ALREADY_CLAIMED");
  }

  // 4. Check IP duplicate (anti-farm)
  const ipKey = `rain:${rainId}:ip:${ipAddress}`;
  const ipCount = await redis.incr(ipKey);
  await redis.expire(ipKey, 3600);
  if (ipCount > 3) {
    await redis.del(claimKey); // Rollback claim
    throw new AppError("Too many claims from this IP", 429, "IP_LIMIT_EXCEEDED");
  }

  // 5. Check remaining claims
  const remaining = await redis.decr(`rain:${rain.id}:remaining`);
  if (remaining < 0) {
    await redis.del(claimKey);
    throw new AppError("Rain has been fully claimed", 400, "RAIN_EXHAUSTED");
  }

  // 6. Credit user (atomic DB transaction)
  await prisma.$transaction(async (tx) => {
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: rain.perClaimAmount } },
    });

    await tx.rainClaim.create({
      data: {
        rainId,
        userId,
        amount: rain.perClaimAmount,
        ipAddress,
      },
    });

    await tx.rainEvent.update({
      where: { id: rainId },
      data: {
        totalClaimed: { increment: 1 },
        totalDistributed: { increment: rain.perClaimAmount },
      },
    });

    await tx.transaction.create({
      data: {
        userId,
        walletId: wallet.id,
        type: "RAIN_CLAIM",
        amount: rain.perClaimAmount,
        status: "CONFIRMED",
        metadata: { rainId, ipAddress },
      },
    });
  });

  logger.info({
    msg: "Rain claimed",
    rainId,
    userId,
    amount: rain.perClaimAmount.toString(),
  });

  return {
    rainId,
    amount: rain.perClaimAmount.toString(),
    remaining: Math.max(0, remaining),
  };
}
