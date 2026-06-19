import { create } from "zustand";

interface GameState {
  // Wallet / Auth
  isConnected: boolean;
  address: string | null;
  token: string | null;

  // Balance
  balance: string;
  lockedBalance: string;

  // Game
  selectedSide: "HEADS" | "TAILS" | null;
  betAmount: string;
  isSpinning: boolean;
  lastResult: "HEADS" | "TAILS" | null;
  won: boolean | null;
  payout: string | null;

  // History
  betHistory: BetRecord[];

  // Actions
  setConnected: (connected: boolean, address?: string) => void;
  setToken: (token: string | null) => void;
  setBalance: (balance: string, locked?: string) => void;
  setSelectedSide: (side: "HEADS" | "TAILS" | null) => void;
  setBetAmount: (amount: string) => void;
  setSpinning: (spinning: boolean) => void;
  setResult: (result: "HEADS" | "TAILS", won: boolean, payout: string) => void;
  addBetToHistory: (bet: BetRecord) => void;
  reset: () => void;
}

interface BetRecord {
  id: string;
  amount: string;
  prediction: "HEADS" | "TAILS";
  outcome: "HEADS" | "TAILS";
  won: boolean;
  payout: string;
  timestamp: string;
}

const initialState = {
  isConnected: false,
  address: null,
  token: null,
  balance: "0.0000",
  lockedBalance: "0.0000",
  selectedSide: null,
  betAmount: "0.1",
  isSpinning: false,
  lastResult: null,
  won: null,
  payout: null,
  betHistory: [],
};

export const useGameStore = create<GameState>((set) => ({
  ...initialState,

  setConnected: (connected, address) =>
    set({ isConnected: connected, address: address ?? null }),

  setToken: (token) => set({ token }),

  setBalance: (balance, locked) =>
    set({ balance, lockedBalance: locked ?? "0.0000" }),

  setSelectedSide: (side) => set({ selectedSide: side }),

  setBetAmount: (amount) => set({ betAmount: amount }),

  setSpinning: (spinning) => set({ isSpinning: spinning }),

  setResult: (result, won, payout) =>
    set({ lastResult: result, won, payout, isSpinning: false }),

  addBetToHistory: (bet) =>
    set((state) => ({
      betHistory: [bet, ...state.betHistory].slice(0, 20),
    })),

  reset: () => set(initialState),
}));
