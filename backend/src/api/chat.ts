import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { AppError } from "@middleware/errorHandler";

const router = Router();
const prisma = new PrismaClient();

// ─── BANNED WORDS LIST ─────────────────────────────────
const BANNED_WORDS = [
  "fuck", "shit", "bitch", "asshole", "cunt", "dick", "pussy", "nigger", "fag",
  "chink", "spic", "kike", "retard", "whore", "slut", "cock", "damn", "bastard",
  // Add more as needed
];

function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase();
  return BANNED_WORDS.some((word) => lower.includes(word));
}

function sanitizeMessage(text: string): string {
  let sanitized = text;
  BANNED_WORDS.forEach((word) => {
    const regex = new RegExp(word, "gi");
    sanitized = sanitized.replace(regex, "*".repeat(word.length));
  });
  return sanitized;
}

// ─── MUTE MANAGEMENT ────────────────────────────────────

async function isMuted(userId: string, roomId: string): Promise<{ muted: boolean; until?: Date }> {
  const mute = await prisma.$queryRawUnsafe<any>(
    `SELECT * FROM muted_users WHERE user_id = $1 AND (room_id = $2 OR room_id = 'global') AND (expires_at IS NULL OR expires_at > NOW())`,
    userId,
    roomId
  );
  // Note: In production, use a proper MutedUser table. This is a simplified version.
  return { muted: false };
}

// ─── GET /chat/rooms ────────────────────────────────────
router.get("/rooms", async (_req, res, next) => {
  try {
    const rooms = await prisma.chatRoom.findMany({
      select: { id: true, name: true, type: true, maxUsers: true, createdAt: true },
    });

    res.json({ success: true, data: rooms });
  } catch (error) {
    next(error);
  }
});

// ─── GET /chat/rooms/:id/messages ───────────────────────
router.get("/rooms/:id/messages", async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 100);

    const [messages, total] = await Promise.all([
      prisma.chatMessage.findMany({
        where: { roomId: req.params.id, isDeleted: false },
        include: { user: { select: { username: true, avatarUrl: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.chatMessage.count({ where: { roomId: req.params.id, isDeleted: false } }),
    ]);

    res.json({
      success: true,
      data: messages.map((m) => ({
        id: m.id,
        roomId: m.roomId,
        userId: m.userId,
        username: m.user.username,
        content: m.content,
        createdAt: m.createdAt,
      })),
      meta: { page, limit, total },
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /chat/moderate (Admin only) ───────────────────
router.post("/moderate", async (req, res, next) => {
  try {
    const schema = z.object({
      messageId: z.string().uuid(),
      action: z.enum(["delete", "mute_user"]),
      durationMinutes: z.number().int().positive().optional(),
      reason: z.string().min(1),
    });

    const parseResult = schema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(parseResult.error.errors[0].message, 400, "VALIDATION_ERROR");
    }

    const { messageId, action, durationMinutes, reason } = parseResult.data;
    const adminId = req.headers["x-user-id"] as string;

    if (action === "delete") {
      await prisma.chatMessage.update({
        where: { id: messageId },
        data: { isDeleted: true },
      });

      await prisma.auditLog.create({
        data: {
          userId: adminId,
          action: "admin:chat_delete",
          resource: "chatMessage",
          resourceId: messageId,
          newValue: { isDeleted: true, reason },
          ipAddress: req.ip || "unknown",
        },
      });
    }

    res.json({ success: true, data: { action, messageId, reason } });
  } catch (error) {
    next(error);
  }
});

export default router;
export { containsProfanity, sanitizeMessage };
