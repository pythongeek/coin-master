/**
 * CryptoFlip Escrow Contract Configuration
 * 
 * Contract addresses are loaded from environment variables.
 * For local development, use .env.local with Anvil/Hardhat local addresses.
 * For production, addresses are injected via CI/CD secrets.
 * 
 * NEVER hardcode production addresses in this file.
 */

export interface ChainConfig {
  id: number;
  name: string;
  rpcUrl: string;
  contractAddress: `0x${string}`;
  blockExplorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  isTestnet: boolean;
}

// Contract addresses from environment or fallback to zero address
function getContractAddress(envVar: string | undefined): `0x${string}` {
  const addr = envVar?.trim();
  if (addr && addr.startsWith('0x') && addr.length === 42) {
    return addr as `0x${string}`;
  }
  // Return zero address for unconfigured chains
  return '0x0000000000000000000000000000000000000000' as `0x${string}`;
}

// RPC URLs with fallbacks
function getRpcUrl(envVar: string | undefined, fallback: string): string {
  return envVar?.trim() || fallback;
}

export const SUPPORTED_CHAINS: Record<string, ChainConfig> = {
  ethereum: {
    id: 1,
    name: 'Ethereum Mainnet',
    rpcUrl: getRpcUrl(
      process.env.RPC_URL_ETH,
      'https://eth-mainnet.g.alchemy.com/v2/demo'
    ),
    contractAddress: getContractAddress(process.env.CONTRACT_ADDRESS_ETH),
    blockExplorer: 'https://etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    isTestnet: false,
  },
  bsc: {
    id: 56,
    name: 'BNB Smart Chain',
    rpcUrl: getRpcUrl(
      process.env.RPC_URL_BSC,
      'https://bsc-dataseed.binance.org'
    ),
    contractAddress: getContractAddress(process.env.CONTRACT_ADDRESS_BSC),
    blockExplorer: 'https://bscscan.com',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    isTestnet: false,
  },
  polygon: {
    id: 137,
    name: 'Polygon',
    rpcUrl: getRpcUrl(
      process.env.RPC_URL_POLYGON,
      'https://polygon-rpc.com'
    ),
    contractAddress: getContractAddress(process.env.CONTRACT_ADDRESS_POLYGON),
    blockExplorer: 'https://polygonscan.com',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    isTestnet: false,
  },
  sepolia: {
    id: 11155111,
    name: 'Sepolia Testnet',
    rpcUrl: getRpcUrl(
      process.env.RPC_URL_SEPOLIA,
      'https://rpc.sepolia.org'
    ),
    contractAddress: getContractAddress(process.env.CONTRACT_ADDRESS_SEPOLIA),
    blockExplorer: 'https://sepolia.etherscan.io',
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
    isTestnet: true,
  },
  anvil: {
    id: 31337,
    name: 'Anvil Local',
    rpcUrl: getRpcUrl(
      process.env.RPC_URL_ANVIL,
      'http://localhost:8545'
    ),
    contractAddress: getContractAddress(process.env.CONTRACT_ADDRESS_ANVIL),
    blockExplorer: '',
    nativeCurrency: { name: 'Anvil Ether', symbol: 'ETH', decimals: 18 },
    isTestnet: true,
  },
};

/**
 * Get chain config by chain ID
 */
export function getChainById(chainId: number): ChainConfig | undefined {
  return Object.values(SUPPORTED_CHAINS).find((c) => c.id === chainId);
}

/**
 * Get chain config by name
 */
export function getChainByName(name: string): ChainConfig | undefined {
  return SUPPORTED_CHAINS[name.toLowerCase()];
}

/**
 * Get all mainnet chains (non-testnet)
 */
export function getMainnetChains(): ChainConfig[] {
  return Object.values(SUPPORTED_CHAINS).filter((c) => !c.isTestnet);
}

/**
 * Validate that a contract address is configured (not zero address)
 */
export function isContractConfigured(chainName: string): boolean {
  const chain = SUPPORTED_CHAINS[chainName.toLowerCase()];
  if (!chain) return false;
  return chain.contractAddress !== '0x0000000000000000000000000000000000000000';
}

/**
 * Get all configured chains (with valid contract addresses)
 */
export function getConfiguredChains(): ChainConfig[] {
  return Object.values(SUPPORTED_CHAINS).filter(
    (c) => c.contractAddress !== '0x0000000000000000000000000000000000000000'
  );
}

/**
 * Contract ABI for CryptoFlipEscrow
 * Full type-safe ABI for viem
 */
export const ESCROW_ABI = [
  {
    inputs: [],
    name: 'deposit',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'to', type: 'address' },
    ],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'lockBet',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'won', type: 'bool' },
    ],
    name: 'settleBet',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getBalance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getHouseBalance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'paused',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'Deposit',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'Withdrawal',
    type: 'event',
  },
] as const;
