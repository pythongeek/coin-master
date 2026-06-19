import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { AppError } from "@middleware/errorHandler";
import { logger } from "@utils/logger";
import { evaluateRisk, buildFraudContext } from "@compliance/fraudEngine";

const router = Router();
const prisma = new PrismaClient();

// ─── RBAC MIDDLEWARE ───────────────────────────────────

type Role = "USER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN";

const ROLE_HIERARCHY: Record<Role, number> = {
  USER: 0,
  MODERATOR: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

function requireRole(minRole: Role) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const userRole = (req.headers["x-user-role"] as Role) || "USER";
    if (ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[minRole]) {
      return next(new AppError("Insufficient permissions", 403, "FORBIDDEN"));
    }
    next();
  };
}

// ─── DASHBOARD ────────────────────────────────────────

router.get("/dashboard", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalBets,
      totalVolume,
      houseProfit,
      pendingWithdrawals,
      openRiskEvents,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { lastActiveAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
      prisma.bet.count(),
      prisma.bet.aggregate({ _sum: { amount: true } }),
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { type: "HOUSE_FEE", status: "CONFIRMED" },
      }),
      prisma.transaction.count({ where: { type: "WITHDRAWAL", status: "PENDING" } }),
      prisma.riskEvent.count({ where: { status: "open" } }),
    ]);

    res.json({
      success: true,
      data: {
        users: { total: totalUsers, active24h: activeUsers },
        bets: { total: totalBets, volume: totalVolume._sum?.amount?.toString() ?? "0" },
        finance: { houseProfit: houseProfit._sum?.amount?.toString() ?? "0", pendingWithdrawals },
        security: { openRiskEvents },
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── USERS ────────────────────────────────────────────

router.get("/users", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = (req.query.search as string) || "";
    const status = req.query.status as string;

    const where: any = {};
    if (search) {
      where.OR = [
        { username: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }
    if (status) where.status = status;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          email: true,
          displayName: true,
          role: true,
          status: true,
          kycStatus: true,
          lastActiveAt: true,
          createdAt: true,
          _count: { select: { bets: true, transactions: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: users.map((u) => ({
        ...u,
        betCount: u._count.bets,
        txCount: u._count.transactions,
        _count: undefined,
      })),
      meta: { page, limit, total },
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/users/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const schema = z.object({
      status: z.enum(["ACTIVE", "SUSPENDED", "BANNED", "PENDING_KYC"]).optional(),
      role: z.enum(["USER", "MODERATOR", "ADMIN", "SUPER_ADMIN"]).optional(),
      kycStatus: z.string().optional(),
      reason: z.string().min(1),
    });

    const parseResult = schema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(parseResult.error.errors[0].message, 400, "VALIDATION_ERROR");
    }

    const { status, role, kycStatus, reason } = parseResult.data;
    const userId = req.headers["x-user-id"] as string;

    const oldUser = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!oldUser) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { status, role, kycStatus },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: userId,
        action: "admin:user_update",
        resource: "user",
        resourceId: req.params.id,
        oldValue: { status: oldUser.status, role: oldUser.role, kycStatus: oldUser.kycStatus },
        newValue: { status: updated.status, role: updated.role, kycStatus: updated.kycStatus },
        ipAddress: req.ip || "unknown",
      },
    });

    res.json({ success: true, data: { user: updated, reason } });
  } catch (error) {
    next(error);
  }
});

// ─── RISK EVENTS ──────────────────────────────────────

router.get("/risk-events", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const status = req.query.status as string || "open";
    const events = await prisma.riskEvent.findMany({
      where: { status },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    res.json({ success: true, data: events });
  } catch (error) {
    next(error);
  }
});

router.patch("/risk-events/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const schema = z.object({
      status: z.enum(["open", "investigating", "resolved", "false_positive"]),
      resolution: z.string().optional(),
    });

    const parseResult = schema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(parseResult.error.errors[0].message, 400, "VALIDATION_ERROR");
    }

    const { status, resolution } = parseResult.data;
    const adminId = req.headers["x-user-id"] as string;

    const event = await prisma.riskEvent.update({
      where: { id: req.params.id },
      data: {
        status,
        resolvedBy: status === "resolved" || status === "false_positive" ? adminId : null,
        resolvedAt: status === "resolved" || status === "false_positive" ? new Date() : null,
      },
    });

    res.json({ success: true, data: event });
  } catch (error) {
    next(error);
  }
});

// ─── AUDIT LOGS ────────────────────────────────────────

router.get("/audit-logs", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const action = req.query.action as string;

    const where: any = {};
    if (action) where.action = action;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { username: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: logs,
      meta: { page, limit, total },
    });
  } catch (error) {
    next(error);
  }
});

// ─── HOUSE CONFIG ───────────────────────────────────────

router.get("/config", requireRole("ADMIN"), async (_req, res, next) => {
  try {
    const config = await prisma.houseConfig.findFirst({
      orderBy: { changedAt: "desc" },
    });

    res.json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
});

router.patch("/config", requireRole("SUPER_ADMIN"), async (req, res, next) => {
  try {
    const schema = z.object({
      houseEdgePercent: z.number().min(0).max(50).optional(),
      maxBetAmount: z.number().positive().optional(),
      minBetAmount: z.number().positive().optional(),
      maxMultiplier: z.number().positive().optional(),
      rainBudgetDaily: z.number().positive().optional(),
      rainStreakTrigger: z.number().int().positive().optional(),
      squadMaxMembers: z.number().int().min(2).max(50).optional(),
    });

    const parseResult = schema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(parseResult.error.errors[0].message, 400, "VALIDATION_ERROR");
    }

    const adminId = req.headers["x-user-id"] as string;

    const oldConfig = await prisma.houseConfig.findFirst({
      orderBy: { changedAt: "desc" },
    });

    const newConfig = await prisma.houseConfig.create({
      data: {
        ...parseResult.data,
        changedBy: adminId,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: "admin:config_change",
        resource: "houseConfig",
        oldValue: oldConfig ?? {},
        newValue: parseResult.data,
        ipAddress: req.ip || "unknown",
      },
    });

    res.json({ success: true, data: newConfig });
  } catch (error) {
    next(error);
  }
});

// ─── SEED ROTATION ────────────────────────────────────

router.post("/seeds/rotate", requireRole("SUPER_ADMIN"), async (req, res, next) => {
  try {
    const adminId = req.headers["x-user-id"] as string;

    // TODO: Phase 4 - Call rotateServerSeed from provablyFair.ts
    // For now, scaffold
    res.json({
      success: true,
      data: {
        message: "Seed rotation initiated",
        adminId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/seeds", requireRole("ADMIN"), async (_req, res, next) => {
  try {
    const seeds = await prisma.serverSeed.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    res.json({ success: true, data: seeds });
  } catch (error) {
    next(error);
  }
});

// ─── BETS & TRANSACTIONS ──────────────────────────────

router.get("/bets", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const status = req.query.status as string;

    const where: any = {};
    if (status) where.status = status;

    const [bets, total] = await Promise.all([
      prisma.bet.findMany({
        where,
        include: {
          user: { select: { username: true } },
          serverSeed: { select: { seedHash: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.bet.count({ where }),
    ]);

    res.json({ success: true, data: bets, meta: { page, limit, total } });
  } catch (error) {
    next(error);
  }
});

router.get("/transactions", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const type = req.query.type as string;

    const where: any = {};
    if (type) where.type = type;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { user: { select: { username: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({ success: true, data: transactions, meta: { page, limit, total } });
  } catch (error) {
    next(error);
  }
});

// ─── FRAUD MANUAL EVALUATION ──────────────────────────

router.post("/fraud/evaluate", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const schema = z.object({ userId: z.string().uuid() });
    const parseResult = schema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError("Invalid userId", 400, "VALIDATION_ERROR");
    }

    const context = await buildFraudContext(parseResult.data.userId);
    const result = await evaluateRisk(parseResult.data.userId, context);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
export { requireRole, ROLE_HIERARCHY };
export type { Role };
