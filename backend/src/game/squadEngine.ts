import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { AppError } from "@middleware/errorHandler";
import { logger } from "@utils/logger";

const prisma = new PrismaClient();

interface CreateSquadInput {
  userId: string;
  name: string;
  targetAmount: Decimal;
  predictedOutcome: "HEADS" | "TAILS";
  maxMembers?: number;
}

interface JoinSquadInput {
  userId: string;
  squadId: string;
  contribution: Decimal;
  walletId: string;
}

/**
 * Creates a new squad with the creator as first member.
 */
export async function createSquad(input: CreateSquadInput) {
  const { userId, name, targetAmount, predictedOutcome, maxMembers = 5 } = input;

  const houseConfig = await prisma.houseConfig.findFirst({
    orderBy: { changedAt: "desc" },
  });
  const squadMax = houseConfig?.squadMaxMembers ?? 5;
  const squadMin = houseConfig?.squadMinMembers ?? 2;

  const squad = await prisma.squad.create({
    data: {
      name,
      status: "FORMING",
      targetAmount,
      collectedAmount: 0,
      memberCount: 1,
      maxMembers: Math.min(maxMembers, squadMax),
      predictedOutcome,
      multiplier: houseConfig?.maxMultiplier ?? 1.98,
      members: {
        create: {
          userId,
          contribution: 0,
          sharePercent: 0,
        },
      },
    },
    include: { members: { include: { user: { select: { username: true } } } } },
  });

  logger.info({ msg: "Squad created", squadId: squad.id, userId });
  return squad;
}

/**
 * Joins a squad. Validates constraints.
 */
export async function joinSquad(input: JoinSquadInput) {
  const { userId, squadId, contribution, walletId } = input;

  const squad = await prisma.squad.findUnique({
    where: { id: squadId },
    include: { members: true },
  });

  if (!squad) {
    throw new AppError("Squad not found", 404, "SQUAD_NOT_FOUND");
  }

  if (squad.status !== "FORMING") {
    throw new AppError("Squad is no longer accepting members", 400, "SQUAD_LOCKED");
  }

  if (squad.members.length >= squad.maxMembers) {
    throw new AppError("Squad is full", 400, "SQUAD_FULL");
  }

  // Check if already in squad
  const existing = squad.members.find((m) => m.userId === userId);
  if (existing) {
    throw new AppError("Already a member of this squad", 400, "ALREADY_MEMBER");
  }

  // Check if user is in any other active squad
  const otherSquad = await prisma.squadMember.findFirst({
    where: { userId, squad: { status: { in: ["FORMING", "READY", "ACTIVE"] } } },
  });
  if (otherSquad) {
    throw new AppError("Already in another active squad", 400, "IN_OTHER_SQUAD");
  }

  // Validate wallet and contribution
  const wallet = await prisma.wallet.findFirst({
    where: { id: walletId, userId },
  });
  if (!wallet) {
    throw new AppError("Wallet not found", 404, "WALLET_NOT_FOUND");
  }

  if (wallet.balance.lessThan(contribution)) {
    throw new AppError("Insufficient balance", 400, "INSUFFICIENT_BALANCE");
  }

  // Deduct contribution from wallet
  await prisma.wallet.update({
    where: { id: walletId },
    data: { balance: { decrement: contribution } },
  });

  // Add member
  const updatedSquad = await prisma.squad.update({
    where: { id: squadId },
    data: {
      collectedAmount: { increment: contribution },
      memberCount: { increment: 1 },
      members: {
        create: {
          userId,
          contribution,
          sharePercent: 0, // Computed on lock
        },
      },
    },
    include: { members: { include: { user: { select: { username: true } } } } },
  });

  // Check if squad is ready (reached target or max members)
  const isReady =
    updatedSquad.collectedAmount.greaterThanOrEqualTo(updatedSquad.targetAmount) ||
    updatedSquad.members.length >= updatedSquad.maxMembers;

  if (isReady) {
    await prisma.squad.update({
      where: { id: squadId },
      data: { status: "READY" },
    });
  }

  logger.info({
    msg: "User joined squad",
    squadId,
    userId,
    contribution: contribution.toString(),
  });

  return updatedSquad;
}

/**
 * Leaves a squad (only if in FORMING state).
 */
export async function leaveSquad(userId: string, squadId: string) {
  const squad = await prisma.squad.findUnique({
    where: { id: squadId },
    include: { members: true },
  });

  if (!squad) {
    throw new AppError("Squad not found", 404, "SQUAD_NOT_FOUND");
  }

  if (squad.status !== "FORMING") {
    throw new AppError("Cannot leave — squad is locked", 400, "SQUAD_LOCKED");
  }

  const member = squad.members.find((m) => m.userId === userId);
  if (!member) {
    throw new AppError("Not a member of this squad", 400, "NOT_MEMBER");
  }

  // Refund contribution
  const wallet = await prisma.wallet.findFirst({
    where: { userId, isPrimary: true },
  });
  if (wallet) {
    await prisma.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: member.contribution } },
    });
  }

  await prisma.squadMember.delete({ where: { id: member.id } });

  const updatedSquad = await prisma.squad.update({
    where: { id: squadId },
    data: {
      collectedAmount: { decrement: member.contribution },
      memberCount: { decrement: 1 },
    },
  });

  logger.info({ msg: "User left squad", squadId, userId });
  return updatedSquad;
}

/**
 * Locks the squad, computes shares, and triggers the bet.
 * Only the creator can lock.
 */
export async function lockSquad(userId: string, squadId: string) {
  const squad = await prisma.squad.findUnique({
    where: { id: squadId },
    include: { members: true },
  });

  if (!squad) {
    throw new AppError("Squad not found", 404, "SQUAD_NOT_FOUND");
  }

  // Creator check (first member is creator)
  const isCreator = squad.members[0]?.userId === userId;
  if (!isCreator) {
    throw new AppError("Only the creator can lock the squad", 403, "NOT_CREATOR");
  }

  if (squad.status !== "READY" && squad.status !== "FORMING") {
    throw new AppError("Squad cannot be locked", 400, "SQUAD_NOT_LOCKABLE");
  }

  const houseConfig = await prisma.houseConfig.findFirst({
    orderBy: { changedAt: "desc" },
  });
  const minMembers = houseConfig?.squadMinMembers ?? 2;

  if (squad.members.length < minMembers) {
    throw new AppError(
      `Need at least ${minMembers} members to lock`,
      400,
      "MIN_MEMBERS_NOT_MET"
    );
  }

  // Compute share percentages
  const totalContribution = squad.members.reduce(
    (sum, m) => sum.plus(m.contribution),
    new Decimal(0)
  );

  await prisma.$transaction(async (tx) => {
    for (const member of squad.members) {
      const share = member.contribution.div(totalContribution).mul(100);
      await tx.squadMember.update({
        where: { id: member.id },
        data: { sharePercent: share },
      });
    }

    await tx.squad.update({
      where: { id: squadId },
      data: { status: "ACTIVE" },
    });
  });

  logger.info({ msg: "Squad locked", squadId, memberCount: squad.members.length });

  // TODO: Place the actual squad bet (integrate with betEngine)
  // For now, return the locked squad
  return prisma.squad.findUnique({
    where: { id: squadId },
    include: { members: { include: { user: { select: { username: true } } } } },
  });
}

/**
 * Calculates squad payout distribution.
 */
export function getSquadDistribution(
  members: { userId: string; contribution: Decimal; sharePercent: Decimal }[],
  totalPayout: Decimal
): { userId: string; payoutAmount: Decimal }[] {
  const totalContributed = members.reduce(
    (sum, m) => sum.plus(m.contribution),
    new Decimal(0)
  );

  return members.map((member) => ({
    userId: member.userId,
    payoutAmount: totalPayout.mul(member.contribution).div(totalContributed),
  }));
}
