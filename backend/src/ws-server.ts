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

  socket.on("disconnect", (reason) => {
    logger.info({ msg: "WS client disconnected", socketId: socket.id, reason });
  });
});

httpServer.listen(PORT, () => {
  logger.info(`🎮 WebSocket Server running on port ${PORT} [${config.NODE_ENV}]`);
});

export { io, redisClient };
