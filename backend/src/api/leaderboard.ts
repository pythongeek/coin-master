import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { AppError } from "@middleware/errorHandler";

const router = Router();
const prisma = new PrismaClient();

// ─── GET /leaderboard/daily ─────────────────────────────
router.get("/daily", async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours

    const topWinners = await prisma.bet.groupBy({
      by: ["userId"],
      where: {
        settledAt: { gte: since },
        status: "COMPLETED",
        won: true as any,
      },
      _sum: { payoutAmount: true },
      _count: { id: true },
      orderBy: { _sum: { payoutAmount: "desc" } },
      take: 10,
    });

    const users = await prisma.user.findMany({
      where: { id: { in: topWinners.map((w) => w.userId) } },
      select: { id: true, username: true, displayName: true, avatarUrl: true },
    });

    const leaderboard = topWinners.map((entry) => {
      const user = users.find((u) => u.id === entry.userId);
      return {
        userId: entry.userId,
        username: user?.username || "Unknown",
        displayName: user?.displayName,
        avatarUrl: user?.avatarUrl,
        totalWon: entry._sum.payoutAmount?.toString() || "0",
        betsWon: entry._count.id,
      };
    });

    res.json({ success: true, data: leaderboard });
  } catch (error) {
    next(error);
  }
});

// ─── GET /leaderboard/weekly ────────────────────────────
router.get("/weekly", async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const topWinners = await prisma.bet.groupBy({
      by: ["userId"],
      where: {
        settledAt: { gte: since },
        status: "COMPLETED",
      },
      _sum: { payoutAmount: true },
      _count: { id: true },
      orderBy: { _sum: { payoutAmount: "desc" } },
      take: 10,
    });

    const users = await prisma.user.findMany({
      where: { id: { in: topWinners.map((w) => w.userId) } },
      select: { id: true, username: true, displayName: true, avatarUrl: true },
    });

    const leaderboard = topWinners.map((entry) => {
      const user = users.find((u) => u.id === entry.userId);
      return {
        userId: entry.userId,
        username: user?.username || "Unknown",
        displayName: user?.displayName,
        avatarUrl: user?.avatarUrl,
        totalWon: entry._sum.payoutAmount?.toString() || "0",
        betsWon: entry._count.id,
      };
    });

    res.json({ success: true, data: leaderboard });
  } catch (error) {
    next(error);
  }
});

// ─── GET /leaderboard/squads ────────────────────────────
router.get("/squads", async (_req, res, next) => {
  try {
    const topSquads = await prisma.squad.findMany({
      where: { status: "DISSOLVED" },
      orderBy: { totalPayout: "desc" },
      take: 10,
      include: {
        members: {
          include: { user: { select: { username: true } } },
        },
      },
    });

    const leaderboard = topSquads.map((squad) => ({
      id: squad.id,
      name: squad.name,
      totalPayout: squad.totalPayout?.toString() || "0",
      memberCount: squad.members.length,
      members: squad.members.map((m) => ({
        username: m.user.username,
        sharePercent: m.sharePercent?.toString(),
        payoutAmount: m.payoutAmount?.toString(),
      })),
    }));

    res.json({ success: true, data: leaderboard });
  } catch (error) {
    next(error);
  }
});

export default router;
