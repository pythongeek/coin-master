import pino from "pino";
import { config } from "@config";

export const logger = pino({
  level: config.LOG_LEVEL,
  transport:
    config.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname",
          },
        }
      : undefined,
  base: {
    env: config.NODE_ENV,
    version: process.env.npm_package_version || "1.0.0",
  },
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie", "password", "secret", "seed", "privateKey"],
    remove: true,
  },
});

export const childLogger = (bindings: Record<string, string>) =>
  logger.child(bindings);
