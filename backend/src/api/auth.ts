import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { AppError } from "@middleware/errorHandler";
import { authRateLimit } from "@middleware/rateLimit";
import { logger } from "@utils/logger";

const router = Router();
const prisma = new PrismaClient();

// ─── IN-MEMORY NONCE STORE (replace with Redis in production) ───
const nonceStore = new Map<string, { nonce: string; expires: number }>();

// ─── EIP-191 SIGNATURE VERIFICATION ───────────────────────

/**
 * Verifies an EIP-191 personal sign message.
 * Returns the recovered address if valid.
 */
async function verifySignature(
  message: string,
  signature: string
): Promise<string> {
  // TODO: Phase 4 - Use viem/ethers for actual on-chain verification
  // For now, mock verification for development
  // import { verifyMessage } from "viem";
  // return verifyMessage({ message, signature });

  logger.warn("Mock signature verification - replace with viem in Phase 4");
  return "0xMOCK_ADDRESS"; // Placeholder
}

// ─── POST /auth/nonce ───────────────────────────────────
router.post("/nonce", authRateLimit, async (req, res, next) => {
  try {
    const schema = z.object({
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
    });

    const parseResult = schema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError("Invalid address format", 400, "VALIDATION_ERROR");
    }

    const { address } = parseResult.data;
    const nonce = randomBytes(32).toString("hex");
    const expires = Date.now() + 5 * 60 * 1000; // 5 minutes

    nonceStore.set(address.toLowerCase(), { nonce, expires });

    res.json({
      success: true,
      data: {
        nonce,
        message: `CryptoFlip Login: nonce=${nonce}`,
        expiresIn: 300,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /auth/verify ──────────────────────────────────
router.post("/verify", authRateLimit, async (req, res, next) => {
  try {
    const schema = z.object({
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      signature: z.string().min(1),
      nonce: z.string().min(1),
      chainId: z.number().optional().default(1),
    });

    const parseResult = schema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError("Invalid request", 400, "VALIDATION_ERROR");
    }

    const { address, signature, nonce, chainId } = parseResult.data;
    const lowerAddress = address.toLowerCase();

    // Verify nonce exists and is not expired
    const stored = nonceStore.get(lowerAddress);
    if (!stored || stored.nonce !== nonce || Date.now() > stored.expires) {
      throw new AppError("Invalid or expired nonce", 401, "INVALID_NONCE");
    }

    // Delete used nonce (one-time use)
    nonceStore.delete(lowerAddress);

    // Verify signature (mock for now, real in Phase 4)
    const recoveredAddress = await verifySignature(
      `CryptoFlip Login: nonce=${nonce}`,
      signature
    );

    // For mock: skip address comparison
    // In production: if (recoveredAddress.toLowerCase() !== lowerAddress) throw error

    // Find or create user
    let user = await prisma.user.findFirst({
      where: { wallets: { some: { address: lowerAddress } } },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          username: `user_${lowerAddress.slice(2, 10)}`,
          wallets: {
            create: {
              walletType: "METAMASK", // TODO: Detect from request
              address: lowerAddress,
              chainId,
              isPrimary: true,
              isVerified: true,
            },
          },
        },
      });
      logger.info({ msg: "New user created", userId: user.id, address: lowerAddress });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastActiveAt: new Date() },
    });

    // TODO: Phase 4 - Generate real JWT (jose library)
    const mockToken = `mock_jwt_${randomBytes(16).toString("hex")}`;

    res.json({
      success: true,
      data: {
        token: mockToken,
        tokenType: "Bearer",
        expiresIn: 900, // 15 minutes
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /auth/refresh ─────────────────────────────────
router.post("/refresh", async (req, res, next) => {
  try {
    // TODO: Implement refresh token rotation
    throw new AppError("Not implemented yet", 501, "NOT_IMPLEMENTED");
  } catch (error) {
    next(error);
  }
});

// ─── POST /auth/logout ──────────────────────────────────
router.post("/logout", async (req, res, next) => {
  try {
    // TODO: Phase 4 - Revoke JWT / session
    res.json({ success: true, data: { message: "Logged out" } });
  } catch (error) {
    next(error);
  }
});

export default router;
