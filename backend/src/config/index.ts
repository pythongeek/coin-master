import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: "../.env" });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.string().default("4000"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),

  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_SIZE: z.string().default("20"),

  REDIS_URL: z.string().min(1),
  REDIS_PASSWORD: z.string().optional(),

  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_EXPIRY: z.string().default("7d"),
  JWT_ALGORITHM: z.string().default("HS256"),

  RPC_URL_ETH: z.string().optional(),
  CONTRACT_ADDRESS_ETH: z.string().optional(),
  PLATFORM_TREASURY_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  WALLET_CONNECT_PROJECT_ID: z.string().optional(),

  HOUSE_EDGE_DEFAULT: z.string().default("2.0"),
  MAX_BET_DEFAULT: z.string().default("10000"),
  MIN_BET_DEFAULT: z.string().default("0.0001"),

  RAIN_DAILY_BUDGET: z.string().default("100"),
  RAIN_MAX_PER_USER_PER_DAY: z.string().default("10"),
  RAIN_MIN_WALLET_AGE_DAYS: z.string().default("7"),
  RAIN_MIN_BET_COUNT: z.string().default("3"),

  PROMETHEUS_PORT: z.string().default("9090"),
  SENTRY_DSN: z.string().optional(),
  SLACK_WEBHOOK: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const config = parsed.data;
