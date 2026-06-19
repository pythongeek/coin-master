import { Router } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import gameRouter from "./game";

const router = Router();

router.use("/health", healthRouter);
router.use("/auth", authRouter);
router.use("/game", gameRouter);

// TODO: Phase 3 - Squad routes
// router.use("/squads", squadRouter);

// TODO: Phase 3 - Rain routes
// router.use("/rains", rainRouter);

// TODO: Phase 3 - Chat routes
// router.use("/chat", chatRouter);

// TODO: Phase 5 - Admin routes
// router.use("/admin", adminRouter);

export default router;
