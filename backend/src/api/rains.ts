import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { AppError } from "@middleware/errorHandler";
import { apiRateLimit } from "@middleware/rateLimit";
import { logger } from "@utils/logger";
import { triggerRain, claimRain } from "@game/rainEngine";

const router = Router();
const prisma = new PrismaClient();

// ─── GET /rains ─────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const status = req.query.status as string || "ACTIVE";
    const rains = await prisma.rainEvent.findMany({
      where: { status: status as any },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    res.json({
      success: true,
      data: rains.map((r) => ({
        id: r.id,
        triggerType: r.triggerType,
        status: r.status,
        totalBudget: r.totalBudget.toString(),
        perClaimAmount: r.perClaimAmount.toString(),
        maxClaims: r.maxClaims,
        totalClaimed: r.totalClaimed,
        totalDistributed: r.totalDistributed.toString(),
        startedAt: r.startedAt,
        endedAt: r.endedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /rains/:id ─────────────────────────────────────
router.get("/:id", async (req, res, next) => {
  try {
    const rain = await prisma.rainEvent.findUnique({
      where: { id: req.params.id },
    });

    if (!rain) {
      throw new AppError("Rain not found", 404, "RAIN_NOT_FOUND");
    }

    res.json({
      success: true,
      data: {
        id: rain.id,
        triggerType: rain.triggerType,
        status: rain.status,
        totalBudget: rain.totalBudget.toString(),
        perClaimAmount: rain.perClaimAmount.toString(),
        maxClaims: rain.maxClaims,
        totalClaimed: rain.totalClaimed,
        totalDistributed: rain.totalDistributed.toString(),
        startedAt: rain.startedAt,
        endedAt: rain.endedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /rains/:id/claim ──────────────────────────────
router.post("/:id/claim", apiRateLimit, async (req, res, next) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    if (!userId) {
      throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    }

    const ipAddress = req.ip || "unknown";
    const result = await claimRain(userId, req.params.id, ipAddress);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
