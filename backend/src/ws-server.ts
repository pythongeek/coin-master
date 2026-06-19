import { createServer } from "http";
import { Server } from "socket.io";
import { Redis } from "ioredis";
import { config } from "@config";
import { logger } from "@utils/logger";

const PORT = 4001;
const httpServer = createServer();

const redisClient = new Redis(config.REDIS_URL);

const io = new Server(httpServer, {
  cors: {
    origin: config.NODE_ENV === "development"
      ? ["http://localhost:3000"]
      : ["https://cryptoflip.io"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
});

io.on("connection", (socket) => {
  logger.info({ msg: "WS client connected", socketId: socket.id });

  socket.on("auth", (data: { token: string }) => {
    logger.info({ msg: "WS auth attempt", socketId: socket.id });
    // TODO: Phase 2 - JWT verification + user room assignment
    socket.emit("auth_result", { success: true });
  });

  socket.on("ping", (data: { timestamp: number }) => {
    socket.emit("pong", { timestamp: data.timestamp, serverTime: Date.now() });
  });

  socket.on("join_room", (data: { room: string }) => {
    socket.join(data.room);
    socket.emit("room_joined", { room: data.room });
    logger.info({ msg: "Client joined room", socketId: socket.id, room: data.room });
  });

  socket.on("leave_room", (data: { room: string }) => {
    socket.leave(data.room);
    socket.emit("room_left", { room: data.room });
  });

  // ─── Phase 5: Chat with Content Moderation ───────────
  socket.on("chat_message", (data: { room: string; content: string }) => {
    const { containsProfanity, sanitizeMessage } = require("@api/chat");
    const sanitized = data.content.substring(0, 500).trim();
    if (!sanitized) return;

    // Check profanity
    if (containsProfanity(sanitized)) {
      const cleanContent = sanitizeMessage(sanitized);
      logger.warn({ msg: "Profanity filtered", room: data.room, socketId: socket.id });

      socket.emit("chat_error", {
        code: "PROFANITY_FILTERED",
        message: "Your message contained inappropriate content and was filtered.",
        original: sanitized,
        filtered: cleanContent,
      });

      // Still broadcast filtered version
      const message = {
        id: Math.random().toString(36).substring(2, 15),
        roomId: data.room,
        userId: "dev-user",
        username: "Player",
        content: cleanContent,
        timestamp: new Date().toISOString(),
        filtered: true,
      };

      io.to(data.room).emit("chat_message", message);
    } else {
      const message = {
        id: Math.random().toString(36).substring(2, 15),
        roomId: data.room,
        userId: "dev-user",
        username: "Player",
        content: sanitized,
        timestamp: new Date().toISOString(),
        filtered: false,
      };

      io.to(data.room).emit("chat_message", message);
      logger.info({ msg: "Chat message", room: data.room, content: sanitized.substring(0, 50) });
    }
  });

  socket.on("chat_delete", (data: { messageId: string; room: string }) => {
    // TODO: Validate moderator/admin permissions
    io.to(data.room).emit("chat_deleted", { id: data.messageId });
  });

  socket.on("disconnect", (reason) => {
    logger.info({ msg: "WS client disconnected", socketId: socket.id, reason });
  });
});

httpServer.listen(PORT, () => {
  logger.info(`🎮 WebSocket Server running on port ${PORT} [${config.NODE_ENV}]`);
});

export { io, redisClient };
