import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { z } from "zod";
import { AppError } from "@middleware/errorHandler";
import { apiRateLimit } from "@middleware/rateLimit";
import { logger } from "@utils/logger";
import { createSquad, joinSquad, leaveSquad, lockSquad, getSquadDistribution } from "@game/squadEngine";

const router = Router();
const prisma = new PrismaClient();

// ─── SCHEMAS ────────────────────────────────────────────

const createSquadSchema = z.object({
  name: z.string().min(1).max(50),
  targetAmount: z.string().regex(/^\d+(\.\d+)?$/),
  predictedOutcome: z.enum(["HEADS", "TAILS"]),
  maxMembers: z.number().min(2).max(10).optional().default(5),
});

const joinSquadSchema = z.object({
  squadId: z.string().uuid(),
  contribution: z.string().regex(/^\d+(\.\d+)?$/),
  walletId: z.string().uuid(),
});

const lockSquadSchema = z.object({
  squadId: z.string().uuid(),
});

// ─── GET /squads ────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const status = req.query.status as string || "FORMING";
    const squads = await prisma.squad.findMany({
      where: { status: status as any },
      include: {
        members: {
          include: { user: { select: { id: true, username: true, avatarUrl: true } } },
        },
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    res.json({
      success: true,
      data: squads.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        targetAmount: s.targetAmount.toString(),
        collectedAmount: s.collectedAmount.toString(),
        memberCount: s._count.members,
        maxMembers: s.maxMembers,
        predictedOutcome: s.predictedOutcome,
        createdAt: s.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /squads ───────────────────────────────────────
router.post("/", apiRateLimit, async (req, res, next) => {
  try {
    const parseResult = createSquadSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(parseResult.error.errors[0].message, 400, "VALIDATION_ERROR");
    }

    const userId = req.headers["x-user-id"] as string;
    if (!userId) {
      throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    }

    // Check cooldown: 5 min between squad creations
    const lastSquad = await prisma.squad.findFirst({
      where: { members: { some: { userId } } },
      orderBy: { createdAt: "desc" },
    });
    if (lastSquad && Date.now() - lastSquad.createdAt.getTime() < 5 * 60 * 1000) {
      throw new AppError("Wait 5 minutes between creating squads", 429, "SQUAD_COOLDOWN");
    }

    const squad = await createSquad({
      userId,
      ...parseResult.data,
      targetAmount: new Decimal(parseResult.data.targetAmount),
    });

    res.json({ success: true, data: squad });
  } catch (error) {
    next(error);
  }
});

// ─── GET /squads/:id ──────────────────────────────────
router.get("/:id", async (req, res, next) => {
  try {
    const squad = await prisma.squad.findUnique({
      where: { id: req.params.id },
      include: {
        members: {
          include: { user: { select: { id: true, username: true, avatarUrl: true } } },
        },
        bets: { take: 1, orderBy: { createdAt: "desc" } },
      },
    });

    if (!squad) {
      throw new AppError("Squad not found", 404, "SQUAD_NOT_FOUND");
    }

    res.json({
      success: true,
      data: {
        id: squad.id,
        name: squad.name,
        status: squad.status,
        targetAmount: squad.targetAmount.toString(),
        collectedAmount: squad.collectedAmount.toString(),
        memberCount: squad.members.length,
        maxMembers: squad.maxMembers,
        predictedOutcome: squad.predictedOutcome,
        multiplier: squad.multiplier.toString(),
        actualOutcome: squad.actualOutcome,
        totalPayout: squad.totalPayout?.toString(),
        members: squad.members.map((m) => ({
          id: m.id,
          userId: m.userId,
          username: m.user.username,
          contribution: m.contribution.toString(),
          sharePercent: m.sharePercent?.toString(),
          payoutAmount: m.payoutAmount?.toString(),
          joinedAt: m.joinedAt,
        })),
        createdAt: squad.createdAt,
        expiredAt: squad.expiredAt,
        settledAt: squad.settledAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /squads/:id/join ─────────────────────────────
router.post("/:id/join", apiRateLimit, async (req, res, next) => {
  try {
    const parseResult = joinSquadSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(parseResult.error.errors[0].message, 400, "VALIDATION_ERROR");
    }

    const userId = req.headers["x-user-id"] as string;
    if (!userId) {
      throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    }

    const result = await joinSquad({
      userId,
      squadId: req.params.id,
      contribution: new Decimal(parseResult.data.contribution),
      walletId: parseResult.data.walletId,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ─── POST /squads/:id/leave ────────────────────────────
router.post("/:id/leave", async (req, res, next) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    if (!userId) {
      throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    }

    const result = await leaveSquad(userId, req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ─── POST /squads/:id/lock ─────────────────────────────
router.post("/:id/lock", async (req, res, next) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    if (!userId) {
      throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    }

    const result = await lockSquad(userId, req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
