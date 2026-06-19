import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { z } from "zod";
import { AppError } from "@middleware/errorHandler";
import { betRateLimit } from "@middleware/rateLimit";
import { placeBet } from "@game/betEngine";
import { getActiveServerSeed } from "@game/provablyFair";
import { logger } from "@utils/logger";

const router = Router();
const prisma = new PrismaClient();

// ─── SCHEMAS ────────────────────────────────────────────

const placeBetSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d+)?$/, "Amount must be a valid decimal string"),
  prediction: z.enum(["HEADS", "TAILS"]),
  clientSeed: z.string().min(1).max(64),
  walletId: z.string().uuid(),
});

// ─── GET /game/config ───────────────────────────────────
router.get("/config", async (_req, res) => {
  const config = await prisma.houseConfig.findFirst({
    orderBy: { changedAt: "desc" },
  });

  const defaultConfig = {
    houseEdgePercent: 2.0,
    maxBetAmount: "10000",
    minBetAmount: "0.0001",
    maxMultiplier: "1.98",
  };

  res.json({
    success: true,
    data: config
      ? {
          houseEdgePercent: config.houseEdgePercent.toNumber(),
          maxBetAmount: config.maxBetAmount.toString(),
          minBetAmount: config.minBetAmount.toString(),
          maxMultiplier: config.maxMultiplier.toString(),
          rainBudgetDaily: config.rainBudgetDaily.toString(),
          rainStreakTrigger: config.rainStreakTrigger,
          squadMaxMembers: config.squadMaxMembers,
        }
      : defaultConfig,
  });
});

// ─── GET /game/seed ─────────────────────────────────────
router.get("/seed", async (_req, res) => {
  const seed = await getActiveServerSeed();
  res.json({
    success: true,
    data: {
      serverSeedHash: seed.seedHash,
      nonce: seed.nonce.toString(),
    },
  });
});

// ─── POST /game/bet ─────────────────────────────────────
router.post("/bet", betRateLimit, async (req, res, next) => {
  try {
    const parseResult = placeBetSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(
        parseResult.error.errors[0].message,
        400,
        "VALIDATION_ERROR"
      );
    }

    const { amount, prediction, clientSeed, walletId } = parseResult.data;

    // TODO: Phase 2 - Get userId from JWT auth middleware
    const userId = req.headers["x-user-id"] as string;
    if (!userId) {
      throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    }

    const result = await placeBet({
      userId,
      walletId,
      amount: new Decimal(amount),
      prediction,
      clientSeed,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ─── GET /game/bet/:id ──────────────────────────────────
router.get("/bet/:id", async (req, res, next) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    if (!userId) {
      throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    }

    const bet = await prisma.bet.findFirst({
      where: { id: req.params.id, userId },
      include: { serverSeed: { select: { seedHash: true } } },
    });

    if (!bet) {
      throw new AppError("Bet not found", 404, "BET_NOT_FOUND");
    }

    res.json({
      success: true,
      data: {
        id: bet.id,
        amount: bet.amount.toString(),
        prediction: bet.predictedOutcome,
        actualOutcome: bet.actualOutcome,
        status: bet.status,
        multiplier: bet.multiplier.toString(),
        payoutAmount: bet.payoutAmount?.toString() ?? null,
        houseFee: bet.houseFee?.toString() ?? null,
        serverSeedHash: bet.serverSeed.seedHash,
        clientSeed: bet.clientSeed,
        nonce: bet.nonce.toString(),
        resultHash: bet.resultHash,
        settledAt: bet.settledAt,
        createdAt: bet.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /game/bet/:id/verify ──────────────────────────
router.post("/bet/:id/verify", async (req, res, next) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    if (!userId) {
      throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    }

    // TODO: Full verification with revealed seed (after rotation)
    const bet = await prisma.bet.findFirst({
      where: { id: req.params.id, userId },
      include: { serverSeed: true },
    });

    if (!bet) {
      throw new AppError("Bet not found", 404, "BET_NOT_FOUND");
    }

    res.json({
      success: true,
      data: {
        betId: bet.id,
        serverSeedHash: bet.serverSeed.seedHash,
        serverSeed: bet.serverSeed.seedValue ?? "REVEALED_AFTER_ROTATION",
        clientSeed: bet.clientSeed,
        nonce: bet.nonce.toString(),
        resultHash: bet.resultHash,
        outcome: bet.actualOutcome,
        // Verification steps will be computed after seed rotation
        verificationSteps: [
          "Step 1: Server seed hash committed before game ✓",
          "Step 2: HMAC computed using server seed + client seed + nonce",
          "Step 3: Outcome extracted from first 8 hex chars",
          `Server seed will be revealed after rotation. Current status: ${
            bet.serverSeed.seedValue ? "REVEALED" : "PENDING"
          }`,
        ],
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
