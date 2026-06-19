import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seed() {
  console.log("🌱 Seeding database...");

  // Create initial house config
  const existingConfig = await prisma.houseConfig.findFirst();
  if (!existingConfig) {
    await prisma.houseConfig.create({
      data: {
        houseEdgePercent: 2.0,
        maxBetAmount: 10000,
        minBetAmount: 0.0001,
        maxMultiplier: 1.98,
        rainBudgetDaily: 100,
        rainStreakTrigger: 5,
        rainPerClaim: 0.001,
        squadMaxMembers: 5,
        squadMinMembers: 2,
        squadTimeoutMinutes: 5,
        changedBy: "system",
      },
    });
    console.log("✅ House config created");
  }

  // Create a test user
  const existingUser = await prisma.user.findFirst({
    where: { username: "testplayer" },
  });

  if (!existingUser) {
    const user = await prisma.user.create({
      data: {
        username: "testplayer",
        displayName: "Test Player",
        role: "USER",
        status: "ACTIVE",
        wallets: {
          create: {
            walletType: "METAMASK",
            address: "0x1234567890abcdef1234567890abcdef12345678",
            chainId: 1,
            isPrimary: true,
            isVerified: true,
            balance: 10.0,
          },
        },
      },
    });
    console.log("✅ Test user created:", user.id);
  }

  // Create initial server seed
  const existingSeed = await prisma.serverSeed.findFirst({
    where: { isActive: true },
  });

  if (!existingSeed) {
    const seed = require("crypto").randomBytes(32).toString("hex");
    const hash = require("crypto").createHash("sha256").update(seed).digest("hex");

    await prisma.serverSeed.create({
      data: {
        seedHash: hash,
        seedValue: seed,
        nonce: 0,
        isActive: true,
      },
    });
    console.log("✅ Initial server seed created");
  }

  console.log("🌱 Seeding complete!");
}

seed()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
