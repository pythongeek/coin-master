import { createPublicClient, createWalletClient, http, parseEther, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, sepolia, bsc, polygon } from "viem/chains";
import { config } from "@config";
import { logger } from "@utils/logger";

// ─── CHAIN CONFIGURATION ────────────────────────────────

export const SUPPORTED_CHAINS = {
  1: { name: "Ethereum", chain: mainnet, rpc: config.RPC_URL_ETH },
  56: { name: "BNB Smart Chain", chain: bsc, rpc: config.RPC_URL_BSC },
  137: { name: "Polygon", chain: polygon, rpc: config.RPC_URL_POLYGON },
  11155111: { name: "Sepolia", chain: sepolia, rpc: config.RPC_URL_ETH },
} as const;

export type SupportedChainId = keyof typeof SUPPORTED_CHAINS;

// ─── CONTRACT ABI ───────────────────────────────────────

export const ESCROW_ABI = [
  {
    inputs: [
      { name: "admin", type: "address" },
      { name: "operator", type: "address" },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [],
    name: "deposit",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ name: "amount", type: "uint256" }],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "user", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "betId", type: "bytes32" },
    ],
    name: "lockBet",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "user", type: "address" },
      { name: "betId", type: "bytes32" },
      { name: "won", type: "bool" },
      { name: "payout", type: "uint256" },
      { name: "houseFee", type: "uint256" },
    ],
    name: "settleBet",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "user", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "unlockBet",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "to", type: "address" },
    ],
    name: "withdrawHouse",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "pause",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "unpause",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "balances",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "lockedBalances",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getUserAvailableBalance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "houseBalance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalVolume",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "paused",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "newBalance", type: "uint256" },
    ],
    name: "Deposited",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "newBalance", type: "uint256" },
    ],
    name: "Withdrawn",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: true, name: "betId", type: "bytes32" },
    ],
    name: "BetLocked",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: true, name: "betId", type: "bytes32" },
      { indexed: false, name: "won", type: "bool" },
      { indexed: false, name: "payout", type: "uint256" },
      { indexed: false, name: "houseFee", type: "uint256" },
    ],
    name: "BetSettled",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, name: "amount", type: "uint256" },
    ],
    name: "HouseFeeCollected",
    type: "event",
  },
] as const;

// ─── CLIENT FACTORY ───────────────────────────────────

export function getPublicClient(chainId: number) {
  const chainConfig = SUPPORTED_CHAINS[chainId as SupportedChainId];
  if (!chainConfig) {
    throw new Error(`Chain ${chainId} not supported`);
  }

  return createPublicClient({
    chain: chainConfig.chain,
    transport: http(chainConfig.rpc),
  });
}

export function getWalletClient(chainId: number, privateKey: `0x${string}`) {
  const chainConfig = SUPPORTED_CHAINS[chainId as SupportedChainId];
  if (!chainConfig) {
    throw new Error(`Chain ${chainId} not supported`);
  }

  const account = privateKeyToAccount(privateKey);

  return createWalletClient({
    account,
    chain: chainConfig.chain,
    transport: http(chainConfig.rpc),
  });
}

// ─── CONTRACT INTERACTION HELPERS ───────────────────────

export function getContractAddress(chainId: number): `0x${string}` {
  const addresses: Record<number, string> = {
    1: config.CONTRACT_ADDRESS_ETH || "0x0000000000000000000000000000000000000000",
    56: config.CONTRACT_ADDRESS_BSC || "0x0000000000000000000000000000000000000000",
    137: config.CONTRACT_ADDRESS_POLYGON || "0x0000000000000000000000000000000000000000",
    11155111: config.CONTRACT_ADDRESS_ETH || "0x0000000000000000000000000000000000000000",
  };

  const addr = addresses[chainId];
  if (!addr || addr === "0x0000000000000000000000000000000000000000") {
    throw new Error(`Contract not deployed on chain ${chainId}`);
  }

  return addr as `0x${string}`;
}

// ─── READ FUNCTIONS ─────────────────────────────────────

export async function getOnChainBalance(
  chainId: number,
  userAddress: string
): Promise<string> {
  const client = getPublicClient(chainId);
  const contractAddress = getContractAddress(chainId);

  const balance = await client.readContract({
    address: contractAddress,
    abi: ESCROW_ABI,
    functionName: "balances",
    args: [userAddress as `0x${string}`],
  });

  return formatEther(balance);
}

export async function getOnChainLockedBalance(
  chainId: number,
  userAddress: string
): Promise<string> {
  const client = getPublicClient(chainId);
  const contractAddress = getContractAddress(chainId);

  const balance = await client.readContract({
    address: contractAddress,
    abi: ESCROW_ABI,
    functionName: "lockedBalances",
    args: [userAddress as `0x${string}`],
  });

  return formatEther(balance);
}

export async function getHouseBalance(chainId: number): Promise<string> {
  const client = getPublicClient(chainId);
  const contractAddress = getContractAddress(chainId);

  const balance = await client.readContract({
    address: contractAddress,
    abi: ESCROW_ABI,
    functionName: "houseBalance",
  });

  return formatEther(balance);
}

export async function getContractPaused(chainId: number): Promise<boolean> {
  const client = getPublicClient(chainId);
  const contractAddress = getContractAddress(chainId);

  return client.readContract({
    address: contractAddress,
    abi: ESCROW_ABI,
    functionName: "paused",
  });
}

// ─── WRITE FUNCTIONS ────────────────────────────────────

export async function settleBetOnChain(
  chainId: number,
  operatorKey: `0x${string}`,
  userAddress: string,
  betId: string,
  won: boolean,
  payout: string,
  houseFee: string
): Promise<string> {
  const wallet = getWalletClient(chainId, operatorKey);
  const contractAddress = getContractAddress(chainId);

  const hash = await wallet.writeContract({
    address: contractAddress,
    abi: ESCROW_ABI,
    functionName: "settleBet",
    args: [
      userAddress as `0x${string}`,
      betId as `0x${string}`,
      won,
      parseEther(payout),
      parseEther(houseFee),
    ],
  });

  logger.info({
    msg: "Bet settled on-chain",
    chainId,
    txHash: hash,
    userAddress,
    betId,
    won,
  });

  return hash;
}

export async function processWithdrawalOnChain(
  chainId: number,
  operatorKey: `0x${string}`,
  userAddress: string,
  amount: string
): Promise<string> {
  const wallet = getWalletClient(chainId, operatorKey);
  const contractAddress = getContractAddress(chainId);

  const hash = await wallet.writeContract({
    address: contractAddress,
    abi: ESCROW_ABI,
    functionName: "withdraw",
    args: [parseEther(amount)],
    account: userAddress as `0x${string}`,
  });

  logger.info({
    msg: "Withdrawal processed on-chain",
    chainId,
    txHash: hash,
    userAddress,
    amount,
  });

  return hash;
}

export async function depositOnChain(
  chainId: number,
  userKey: `0x${string}`,
  amount: string
): Promise<string> {
  const wallet = getWalletClient(chainId, userKey);
  const contractAddress = getContractAddress(chainId);

  const hash = await wallet.sendTransaction({
    to: contractAddress,
    value: parseEther(amount),
  });

  logger.info({
    msg: "Deposit sent on-chain",
    chainId,
    txHash: hash,
    amount,
  });

  return hash;
}

// ─── EVENT LISTENING ────────────────────────────────────

export async function watchDeposits(
  chainId: number,
  callback: (event: {
    user: string;
    amount: string;
    newBalance: string;
    txHash: string;
  }) => void
) {
  const client = getPublicClient(chainId);
  const contractAddress = getContractAddress(chainId);

  return client.watchContractEvent({
    address: contractAddress,
    abi: ESCROW_ABI,
    eventName: "Deposited",
    onLogs: (logs) => {
      for (const log of logs) {
        if (log.args) {
          callback({
            user: log.args.user,
            amount: formatEther(log.args.amount),
            newBalance: formatEther(log.args.newBalance),
            txHash: log.transactionHash,
          });
        }
      }
    },
  });
}

export async function getDepositEvents(
  chainId: number,
  fromBlock: bigint,
  toBlock: bigint
) {
  const client = getPublicClient(chainId);
  const contractAddress = getContractAddress(chainId);

  const logs = await client.getContractEvents({
    address: contractAddress,
    abi: ESCROW_ABI,
    eventName: "Deposited",
    fromBlock,
    toBlock,
  });

  return logs.map((log) => ({
    user: log.args.user,
    amount: formatEther(log.args.amount),
    newBalance: formatEther(log.args.newBalance),
    txHash: log.transactionHash,
    blockNumber: log.blockNumber,
  }));
}
