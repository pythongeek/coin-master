import { Router } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import gameRouter from "./game";
import squadRouter from "./squads";
import rainRouter from "./rains";
import leaderboardRouter from "./leaderboard";
import walletRouter from "./wallets";
import adminRouter from "./admin";
import chatRouter from "./chat";

const router = Router();

router.use("/health", healthRouter);
router.use("/auth", authRouter);
router.use("/game", gameRouter);
router.use("/squads", squadRouter);
router.use("/rains", rainRouter);
router.use("/leaderboard", leaderboardRouter);
router.use("/wallets", walletRouter);
router.use("/admin", adminRouter);
router.use("/chat", chatRouter);

export default router;
