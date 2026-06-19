import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { Redis } from "ioredis";
import { config } from "@config";
import { logger } from "@utils/logger";
import { getActiveServerSeed, generateOutcome, verifyResult } from "./provablyFair";
import { AppError } from "@middleware/errorHandler";

const prisma = new PrismaClient();
const redis = new Redis(config.REDIS_URL);

// ─── BALANCE LOCKING (ATOMIC, LUA SCRIPT) ─────────────────

const LOCK_BALANCE_SCRIPT = `
  local balanceKey = KEYS[1]
  local lockKey = KEYS[2]
  local amount = tonumber(ARGV[1])
  local ttl = tonumber(ARGV[2])
  
  local balance = tonumber(redis.call('GET', balanceKey) or 0)
  local locked = tonumber(redis.call('GET', lockKey) or 0)
  local available = balance - locked
  
  if available < amount then
    return {-1, available}
  end
  
  redis.call('INCRBY', lockKey, amount)
  redis.call('EXPIRE', lockKey, ttl)
  
  return {1, available - amount}
`;

const UNLOCK_BALANCE_SCRIPT = `
  local lockKey = KEYS[1]
  local amount = tonumber(ARGV[1])
  
  local current = tonumber(redis.call('GET', lockKey) or 0)
  if current >= amount then
    redis.call('DECRBY', lockKey, amount)
  end
  return 1
`;

/**
 * Atomically locks bet amount from user's wallet balance.
 * Prevents race conditions / double-spend.
 */
export async function lockBetAmount(
  walletId: string,
  amount: Decimal
): Promise<{ success: boolean; available: number }> {
  const balanceKey = `wallet:${walletId}:balance`;
  const lockKey = `wallet:${walletId}:locked`;

  const result = (await redis.eval(
    LOCK_BALANCE_SCRIPT,
    2,
    balanceKey,
    lockKey,
    amount.toString(),
    "60" // 60-second TTL on lock
  )) as [number, number];

  if (result[0] === -1) {
    return { success: false, available: result[1] };
  }

  return { success: true, available: result[1] };
}

/**
 * Unlocks previously locked amount.
 */
export async function unlockBetAmount(
  walletId: string,
  amount: Decimal
): Promise<void> {
  const lockKey = `wallet:${walletId}:locked`;
  await redis.eval(UNLOCK_BALANCE_SCRIPT, 1, lockKey, amount.toString());
}

// ─── BET PLACEMENT ───────────────────────────────────────

interface PlaceBetInput {
  userId: string;
  walletId: string;
  amount: Decimal;
  prediction: "HEADS" | "TAILS";
  clientSeed: string;
}

export async function placeBet(input: PlaceBetInput) {
  const { userId, walletId, amount, prediction, clientSeed } = input;

  // 1. Validate house config
  const houseConfig = await prisma.houseConfig.findFirst({
    orderBy: { changedAt: "desc" },
  });

  const minBet = houseConfig?.minBetAmount ?? new Decimal(config.MIN_BET_DEFAULT);
  const maxBet = houseConfig?.maxBetAmount ?? new Decimal(config.MAX_BET_DEFAULT);

  if (amount.lessThan(minBet)) {
    throw new AppError(`Minimum bet is ${minBet}`, 400, "MIN_BET_EXCEEDED");
  }
  if (amount.greaterThan(maxBet)) {
    throw new AppError(`Maximum bet is ${maxBet}`, 400, "MAX_BET_EXCEEDED");
  }

  // 2. Verify wallet ownership and balance
  const wallet = await prisma.wallet.findFirst({
    where: { id: walletId, userId },
  });

  if (!wallet) {
    throw new AppError("Wallet not found", 404, "WALLET_NOT_FOUND");
  }

  // 3. Sync Redis balance from DB (if not cached)
  const balanceKey = `wallet:${walletId}:balance`;
  const cachedBalance = await redis.get(balanceKey);
  if (!cachedBalance) {
    await redis.set(balanceKey, wallet.balance.toString());
  }

  // 4. Atomically lock the bet amount
  const lockResult = await lockBetAmount(walletId, amount);
  if (!lockResult.success) {
    throw new AppError(
      `Insufficient balance. Available: ${lockResult.available}`,
      400,
      "INSUFFICIENT_BALANCE"
    );
  }

  // 5. Get active server seed and increment nonce
  const serverSeed = await getActiveServerSeed();

  // 6. Compute outcome (deterministic)
  const { outcome, hash: resultHash } = generateOutcome(
    serverSeed.seedHash, // NOTE: In real impl, use actual seed value from DB (Phase 5 encryption)
    clientSeed,
    serverSeed.nonce
  );

  // 7. Create bet in DB (atomic transaction)
  const bet = await prisma.$transaction(async (tx) => {
    // Increment nonce
    await tx.serverSeed.update({
      where: { id: serverSeed.id },
      data: { nonce: { increment: 1n } },
    });

    // Create bet record
    const newBet = await tx.bet.create({
      data: {
        userId,
        walletId,
        amount,
        predictedOutcome: prediction,
        actualOutcome: outcome,
        serverSeedId: serverSeed.id,
        clientSeed,
        nonce: serverSeed.nonce,
        resultHash,
        status: "COMPLETED",
        settledAt: new Date(),
      },
    });

    // Calculate payout
    const houseEdge = houseConfig?.houseEdgePercent ?? new Decimal(config.HOUSE_EDGE_DEFAULT);
    const multiplier = new Decimal(100).minus(houseEdge).div(100).mul(2); // 98% = 1.98x
    const won = prediction === outcome;

    let payoutAmount: Decimal | null = null;
    let houseFee: Decimal | null = null;

    if (won) {
      payoutAmount = amount.mul(multiplier);
      houseFee = amount.mul(houseEdge).div(100);

      // Credit winnings to wallet
      await tx.wallet.update({
        where: { id: walletId },
        data: { balance: { increment: payoutAmount } },
      });
    } else {
      // House keeps the loss
      houseFee = amount.mul(houseEdge).div(100);
      // Payout = 0 (user lost)
      payoutAmount = new Decimal(0);
    }

    // Update bet with payout
    await tx.bet.update({
      where: { id: newBet.id },
      data: { payoutAmount, houseFee, multiplier },
    });

    // Create transaction record
    await tx.transaction.create({
      data: {
        userId,
        walletId,
        type: won ? "BET_WON" : "BET_LOST",
        amount: won ? payoutAmount : amount.neg(),
        status: "CONFIRMED",
        betId: newBet.id,
        metadata: { outcome, resultHash, clientSeed, serverSeedHash: serverSeed.seedHash },
      },
    });

    return newBet;
  });

  // 8. Unlock the locked amount (since bet is settled)
  await unlockBetAmount(walletId, amount);

  // 9. Update Redis balance cache
  const updatedWallet = await prisma.wallet.findUnique({ where: { id: walletId } });
  if (updatedWallet) {
    await redis.set(balanceKey, updatedWallet.balance.toString());
  }

  logger.info({
    msg: "Bet settled",
    betId: bet.id,
    userId,
    amount: amount.toString(),
    prediction,
    outcome,
    won: prediction === outcome,
  });

  return {
    betId: bet.id,
    outcome,
    won: prediction === outcome,
    payoutAmount: bet.payoutAmount?.toString() ?? "0",
    resultHash,
    serverSeedHash: serverSeed.seedHash,
    nonce: serverSeed.nonce.toString(),
  };
}

// ─── BET VERIFICATION ───────────────────────────────────

export async function verifyBet(betId: string, userId: string) {
  const bet = await prisma.bet.findFirst({
    where: { id: betId, userId },
    include: { serverSeed: true },
  });

  if (!bet) {
    throw new AppError("Bet not found", 404, "BET_NOT_FOUND");
  }

  if (!bet.serverSeed.seedValue) {
    throw new AppError(
      "Server seed not yet revealed. Wait for seed rotation.",
      400,
      "SEED_NOT_REVEALED"
    );
  }

  const { valid, steps } = verifyResult(
    bet.serverSeed.seedValue,
    bet.serverSeed.seedHash,
    bet.clientSeed,
    bet.nonce,
    bet.resultHash ?? ""
  );

  return {
    betId: bet.id,
    serverSeedHash: bet.serverSeed.seedHash,
    serverSeed: bet.serverSeed.seedValue,
    clientSeed: bet.clientSeed,
    nonce: bet.nonce.toString(),
    resultHash: bet.resultHash,
    outcome: bet.actualOutcome,
    valid,
    verificationSteps: steps,
  };
}
