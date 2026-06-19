import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { Redis } from "ioredis";
import { config } from "@config";

const redisClient = new Redis(config.REDIS_URL);

export const createRateLimiter = (
  windowMs: number,
  maxRequests: number,
  keyPrefix: string
) => {
  return rateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    keyPrefix,
    store: new RedisStore({
      sendCommand: (...args: string[]) => redisClient.call(...args),
    }),
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests, please try again later",
        },
      });
    },
  });
};

// Per-endpoint rate limiters
export const authRateLimit = createRateLimiter(60 * 1000, 5, "rl:auth");        // 5 per minute
export const betRateLimit = createRateLimiter(60 * 1000, 10, "rl:bet");         // 10 per minute
export const apiRateLimit = createRateLimiter(60 * 1000, 60, "rl:api");           // 60 per minute
export const strictApiRateLimit = createRateLimiter(60 * 1000, 30, "rl:strict");  // 30 per minute
