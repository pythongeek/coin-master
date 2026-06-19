import express from "express";
import helmet from "helmet";
import cors from "cors";
import hpp from "hpp";
import compression from "compression";
import { config } from "@config";
import { logger } from "@utils/logger";
import { errorHandler, notFoundHandler } from "@middleware/errorHandler";
import { apiRateLimit } from "@middleware/rateLimit";
import apiRoutes from "@api";

const app = express();
const PORT = parseInt(config.PORT, 10);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "wss:", "https:"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      mediaSrc: ["'self'", "https:"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
}));

app.use(cors({
  origin: config.NODE_ENV === "development"
    ? ["http://localhost:3000", "http://localhost:3001"]
    : ["https://cryptoflip.io", "https://www.cryptoflip.io"],
  credentials: true,
}));

app.use(hpp());
app.use(compression());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Rate limiting
app.use("/api/", apiRateLimit);

// Request logging
app.use((req, _res, next) => {
  logger.info({
    msg: "Incoming request",
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

// Routes
app.use("/api", apiRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`🚀 API Server running on port ${PORT} [${config.NODE_ENV}]`);
});

export default app;
