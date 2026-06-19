import { Router, Request, Response } from "express";
import { HealthCheck } from "@types";
import { logger } from "@utils/logger";

const router = Router();

let startTime = Date.now();

router.get("/health", (_req: Request, res: Response) => {
  const health: HealthCheck = {
    status: "ok",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    uptime: Date.now() - startTime,
    services: {
      database: "connected", // TODO: actual DB check in Phase 2
      redis: "connected",    // TODO: actual Redis check in Phase 2
    },
  };
  res.status(200).json({ success: true, data: health });
});

router.get("/health/ready", (_req: Request, res: Response) => {
  // Kubernetes readiness probe
  res.status(200).json({ success: true, data: { ready: true } });
});

router.get("/health/live", (_req: Request, res: Response) => {
  // Kubernetes liveness probe
  res.status(200).json({ success: true, data: { alive: true } });
});

router.get("/metrics", (_req: Request, res: Response) => {
  // TODO: Prometheus metrics in Phase 6
  res.status(200).type("text/plain").send("# Metrics placeholder\n");
});

export default router;
