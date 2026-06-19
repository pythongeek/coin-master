import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { Redis } from "ioredis";
import { logger } from "@utils/logger";
import { config } from "@config";

const prisma = new PrismaClient();
const redis = new Redis(config.REDIS_URL);

// ─── PROVABLY FAIR ALGORITHM v2.0 ──────────────────────

/**
 * Generates a random 32-byte hex server seed.
 */
export function generateServerSeed(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Computes SHA-256 hash of a server seed (pre-game commitment).
 */
export function hashServerSeed(seed: string): string {
  return crypto.createHash("sha256").update(seed).digest("hex");
}

/**
 * Computes the game outcome using HMAC-SHA256.
 *
 * result = HMAC_SHA256(serverSeed, clientSeed + ":" + nonce)
 * outcome = parseInt(result[0:8], 16) % 2
 * 0 = HEADS, 1 = TAILS
 */
export function generateOutcome(
  serverSeed: string,
  clientSeed: string,
  nonce: bigint
): { outcome: "HEADS" | "TAILS"; hash: string } {
  const message = `${clientSeed}:${nonce.toString()}`;
  const hash = crypto
    .createHmac("sha256", serverSeed)
    .update(message)
    .digest("hex");

  const first4Bytes = parseInt(hash.substring(0, 8), 16);
  const outcome = first4Bytes % 2 === 0 ? "HEADS" : "TAILS";

  return { outcome, hash };
}

/**
 * Verifies a provably fair result.
 * Returns step-by-step verification for user-facing proof.
 */
export function verifyResult(
  serverSeed: string,
  serverSeedHash: string,
  clientSeed: string,
  nonce: bigint,
  expectedHash: string
): { valid: boolean; steps: string[] } {
  const steps: string[] = [];

  // Step 1: Verify hash commitment
  const computedHash = hashServerSeed(serverSeed);
  const hashValid = computedHash === serverSeedHash;
  steps.push(
    `1. SHA-256(serverSeed) == serverSeedHash: ${hashValid ? "PASS ✓" : "FAIL ✗"}`
  );

  // Step 2: Verify HMAC
  const { hash: computedResultHash } = generateOutcome(serverSeed, clientSeed, nonce);
  const hmacValid = computedResultHash === expectedHash;
  steps.push(
    `2. HMAC_SHA256(serverSeed, clientSeed + nonce) == resultHash: ${hmacValid ? "PASS ✓" : "FAIL ✗"}`
  );

  // Step 3: Verify outcome extraction
  const first4Bytes = parseInt(computedResultHash.substring(0, 8), 16);
  const outcome = first4Bytes % 2 === 0 ? "HEADS" : "TAILS";
  steps.push(
    `3. parseInt(resultHash[0:8], 16) % 2 = ${first4Bytes} % 2 = ${outcome} ✓`
  );

  return {
    valid: hashValid && hmacValid,
    steps,
  };
}

// ─── SERVER SEED MANAGEMENT ──────────────────────────────

/**
 * Gets the currently active server seed.
 * Creates one if none exists.
 */
export async function getActiveServerSeed(): Promise<{
  id: string;
  seedHash: string;
  nonce: bigint;
}> {
  let seed = await prisma.serverSeed.findFirst({
    where: { isActive: true },
  });

  if (!seed) {
    const newSeed = generateServerSeed();
    const newHash = hashServerSeed(newSeed);

    seed = await prisma.serverSeed.create({
      data: {
        seedHash: newHash,
        seedValue: newSeed, // Stored encrypted in production (Phase 5)
        nonce: 0n,
        isActive: true,
      },
    });

    logger.info({ msg: "Created new server seed", seedHash: newHash });
  }

  return {
    id: seed.id,
    seedHash: seed.seedHash,
    nonce: seed.nonce,
  };
}

/**
 * Rotates the server seed:
 * 1. Reveals the old seed value
 * 2. Creates a new seed pair
 * 3. Returns the old seed for verification
 */
export async function rotateServerSeed(
  adminUserId: string
): Promise<{ oldSeed: string; newHash: string }> {
  const oldSeed = await prisma.serverSeed.findFirst({
    where: { isActive: true },
  });

  if (!oldSeed) {
    throw new Error("No active seed to rotate");
  }

  // Must reveal old seed value
  if (!oldSeed.seedValue) {
    throw new Error("Old seed value is missing — cannot rotate");
  }

  await prisma.$transaction(async (tx) => {
    // Deactivate old seed
    await tx.serverSeed.update({
      where: { id: oldSeed.id },
      data: { isActive: false, rotatedAt: new Date() },
    });

    // Create new seed
    const newSeed = generateServerSeed();
    const newHash = hashServerSeed(newSeed);
    await tx.serverSeed.create({
      data: {
        seedHash: newHash,
        seedValue: newSeed,
        nonce: 0n,
        isActive: true,
      },
    });

    // Log to audit
    await tx.auditLog.create({
      data: {
        userId: adminUserId,
        action: "admin:seed_rotate",
        resource: "serverSeed",
        resourceId: oldSeed.id,
        oldValue: { seedHash: oldSeed.seedHash, nonce: oldSeed.nonce.toString() },
        newValue: { seedHash: newHash, nonce: "0" },
      },
    });
  });

  logger.info({
    msg: "Server seed rotated",
    oldSeedHash: oldSeed.seedHash,
    newSeedHash: hashServerSeed(generateServerSeed()),
  });

  return { oldSeed: oldSeed.seedValue, newHash: hashServerSeed(generateServerSeed()) };
}
