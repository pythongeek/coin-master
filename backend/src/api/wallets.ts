import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { z } from "zod";
import { AppError } from "@middleware/errorHandler";
import { apiRateLimit } from "@middleware/rateLimit";
import { logger } from "@utils/logger";
import { getOnChainBalance, getOnChainLockedBalance } from "@blockchain/contract";

const router = Router();
const prisma = new PrismaClient();

// ─── GET /wallets ───────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    if (!userId) {
      throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    }

    const wallets = await prisma.wallet.findMany({
      where: { userId },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
    });

    res.json({
      success: true,
      data: wallets.map((w) => ({
        id: w.id,
        walletType: w.walletType,
        address: w.address,
        chainId: w.chainId,
        isPrimary: w.isPrimary,
        isVerified: w.isVerified,
        balance: w.balance.toString(),
        locked: w.balanceLocked.toString(),
        createdAt: w.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /wallets ────────────────────────────────────
router.post("/", async (req, res, next) => {
  try {
    const schema = z.object({
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
      chainId: z.number().min(1),
      walletType: z.enum(["METAMASK", "PHANTOM", "WALLET_CONNECT", "COINBASE"]),
    });

    const parseResult = schema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(parseResult.error.errors[0].message, 400, "VALIDATION_ERROR");
    }

    const userId = req.headers["x-user-id"] as string;
    if (!userId) {
      throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    }

    const { address, chainId, walletType } = parseResult.data;

    // Check if already exists
    const existing = await prisma.wallet.findFirst({
      where: { address: address.toLowerCase(), chainId },
    });

    if (existing) {
      throw new AppError("Wallet already linked", 400, "WALLET_EXISTS");
    }

    const wallet = await prisma.wallet.create({
      data: {
        userId,
        walletType,
        address: address.toLowerCase(),
        chainId,
        isPrimary: false, // First wallet is set as primary elsewhere
        isVerified: false, // Must sign message to verify
      },
    });

    res.json({
      success: true,
      data: {
        id: wallet.id,
        address: wallet.address,
        chainId: wallet.chainId,
        walletType: wallet.walletType,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /wallets/:id/verify ─────────────────────────
router.post("/:id/verify", async (req, res, next) => {
  try {
    const schema = z.object({
      signature: z.string().min(1),
    });

    const parseResult = schema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError("Invalid signature", 400, "VALIDATION_ERROR");
    }

    const userId = req.headers["x-user-id"] as string;
    if (!userId) {
      throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    }

    const wallet = await prisma.wallet.findFirst({
      where: { id: req.params.id, userId },
    });

    if (!wallet) {
      throw new AppError("Wallet not found", 404, "WALLET_NOT_FOUND");
    }

    // TODO: Phase 4 - Real EIP-191 signature verification via viem
    // import { verifyMessage } from "viem";
    // const isValid = await verifyMessage({
    //   address: wallet.address as `0x${string}`,
    //   message: `CryptoFlip Verify: ${wallet.id}`,
    //   signature: signature as `0x${string}`,
    // });

    // For now: mark as verified for development
    const updated = await prisma.wallet.update({
      where: { id: wallet.id },
      data: { isVerified: true },
    });

    res.json({
      success: true,
      data: {
        id: updated.id,
        isVerified: updated.isVerified,
        verifiedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /wallets/:id/deposit ────────────────────────
router.post("/:id/deposit", async (req, res, next) => {
  try {
    const schema = z.object({
      amount: z.string().regex(/^\d+(\.\d+)?$/),
    });

    const parseResult = schema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError("Invalid amount", 400, "VALIDATION_ERROR");
    }

    const userId = req.headers["x-user-id"] as string;
    if (!userId) {
      throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    }

    const wallet = await prisma.wallet.findFirst({
      where: { id: req.params.id, userId },
    });

    if (!wallet) {
      throw new AppError("Wallet not found", 404, "WALLET_NOT_FOUND");
    }

    // Create deposit transaction record (pending until on-chain confirmation)
    const tx = await prisma.transaction.create({
      data: {
        userId,
        walletId: wallet.id,
        type: "DEPOSIT",
        amount: new Decimal(parseResult.data.amount),
        status: "PENDING",
        metadata: {
          chainId: wallet.chainId,
          address: wallet.address,
        },
      },
    });

    // TODO: Phase 4 - Queue deposit job to worker for on-chain monitoring
    // await queues.deposit.add("monitor-deposit", { txId: tx.id, ... });

    res.json({
      success: true,
      data: {
        txId: tx.id,
        status: "PENDING",
        depositAddress: wallet.address,
        amount: parseResult.data.amount,
        chainId: wallet.chainId,
        message: "Send ETH to your deposit address. We'll detect it automatically.",
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /wallets/:id/withdraw ───────────────────────
router.post("/:id/withdraw", apiRateLimit, async (req, res, next) => {
  try {
    const schema = z.object({
      amount: z.string().regex(/^\d+(\.\d+)?$/),
      toAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
    });

    const parseResult = schema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(parseResult.error.errors[0].message, 400, "VALIDATION_ERROR");
    }

    const userId = req.headers["x-user-id"] as string;
    if (!userId) {
      throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    }

    const wallet = await prisma.wallet.findFirst({
      where: { id: req.params.id, userId },
    });

    if (!wallet) {
      throw new AppError("Wallet not found", 404, "WALLET_NOT_FOUND");
    }

    const amount = new Decimal(parseResult.data.amount);

    if (wallet.balance.lessThan(amount)) {
      throw new AppError("Insufficient balance", 400, "INSUFFICIENT_BALANCE");
    }

    if (wallet.balanceLocked.greaterThan(0)) {
      throw new AppError("Cannot withdraw while bets are locked", 400, "BETS_LOCKED");
    }

    // Create withdrawal transaction record
    const tx = await prisma.$transaction(async (prismaTx) => {
      // Lock the amount
      await prismaTx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: amount },
          balanceLocked: { increment: amount },
        },
      });

      return prismaTx.transaction.create({
        data: {
          userId,
          walletId: wallet.id,
          type: "WITHDRAWAL",
          amount: amount.neg(),
          status: "PENDING",
          metadata: {
            chainId: wallet.chainId,
            toAddress: parseResult.data.toAddress || wallet.address,
          },
        },
      });
    });

    // TODO: Phase 4 - Queue to BullMQ for blockchain processing
    // await queues.withdrawal.add("process-withdrawal", { txId: tx.id });

    res.json({
      success: true,
      data: {
        txId: tx.id,
        status: "PENDING",
        amount: amount.toString(),
        toAddress: parseResult.data.toAddress || wallet.address,
        estimatedTime: "2-5 minutes",
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /wallets/:id/balance ─────────────────────────
router.get("/:id/balance", async (req, res, next) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    if (!userId) {
      throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    }

    const wallet = await prisma.wallet.findFirst({
      where: { id: req.params.id, userId },
    });

    if (!wallet) {
      throw new AppError("Wallet not found", 404, "WALLET_NOT_FOUND");
    }

    // Off-chain balance
    const offChainBalance = wallet.balance.toString();
    const offChainLocked = wallet.balanceLocked.toString();

    // On-chain balance (if contract deployed)
    let onChainBalance = "0";
    let onChainLocked = "0";
    try {
      onChainBalance = await getOnChainBalance(wallet.chainId, wallet.address);
      onChainLocked = await getOnChainLockedBalance(wallet.chainId, wallet.address);
    } catch (err) {
      logger.warn({ msg: "Could not fetch on-chain balance", walletId: wallet.id, error: err });
    }

    res.json({
      success: true,
      data: {
        offChain: {
          balance: offChainBalance,
          locked: offChainLocked,
          available: wallet.balance.minus(wallet.balanceLocked).toString(),
        },
        onChain: {
          balance: onChainBalance,
          locked: onChainLocked,
        },
        chainId: wallet.chainId,
        address: wallet.address,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
