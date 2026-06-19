"use client";

import { useState } from "react";
import { ArrowLeftRight, Zap, Trophy, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGameStore } from "@/stores/gameStore";
import CoinScene from "./CoinScene";

const PRESET_AMOUNTS = ["0.01", "0.05", "0.1", "0.5", "1", "5"];

export default function GamePanel() {
  const {
    balance,
    selectedSide,
    betAmount,
    isSpinning,
    isConnected,
    lastResult,
    won,
    payout,
    setSelectedSide,
    setBetAmount,
    setSpinning,
    setResult,
    setBalance,
    addBetToHistory,
  } = useGameStore();

  const [clientSeed, setClientSeed] = useState(() =>
    Math.random().toString(36).substring(2, 15)
  );
  const [error, setError] = useState<string | null>(null);

  const handleBet = async () => {
    if (!isConnected) {
      setError("Connect your wallet first");
      return;
    }
    if (!selectedSide) {
      setError("Choose HEADS or TAILS");
      return;
    }
    if (parseFloat(betAmount) <= 0) {
      setError("Enter a valid bet amount");
      return;
    }
    if (parseFloat(betAmount) > parseFloat(balance)) {
      setError("Insufficient balance");
      return;
    }

    setError(null);
    setSpinning(true);

    try {
      const token = useGameStore.getState().token;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/game/bet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": "dev-user-id",
        },
        body: JSON.stringify({
          amount: betAmount,
          prediction: selectedSide,
          clientSeed,
          walletId: "dev-wallet-id",
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Bet failed");
      }

      await new Promise((r) => setTimeout(r, 2000));

      setResult(
        data.data.outcome,
        data.data.won,
        data.data.payoutAmount
      );
      setBalance(
        (parseFloat(balance) + (data.data.won ? parseFloat(data.data.payoutAmount) : -parseFloat(betAmount))).toFixed(4)
      );

      addBetToHistory({
        id: data.data.betId,
        amount: betAmount,
        prediction: selectedSide,
        outcome: data.data.outcome,
        won: data.data.won,
        payout: data.data.payoutAmount,
        timestamp: new Date().toISOString(),
      });

      setClientSeed(Math.random().toString(36).substring(2, 15));
    } catch (err: any) {
      setError(err.message);
      setSpinning(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <CoinScene />

      {lastResult && !isSpinning && (
        <div
          className={`text-center py-3 rounded-xl font-bold text-xl ${
            won
              ? "bg-green-500/20 text-green-400 border border-green-500/30"
              : "bg-red-500/20 text-red-400 border border-red-500/30"
          }`}
        >
          {won ? (
            <span className="flex items-center justify-center gap-2">
              <Trophy className="w-6 h-6" /> You won {payout}!
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <ArrowLeftRight className="w-6 h-6" /> It was {lastResult}
            </span>
          )}
        </div>
      )}

      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
        <label className="text-sm text-slate-400 mb-2 block">Bet Amount</label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400" />
            <input
              type="number"
              step="0.01"
              min="0.0001"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>
          <span className="text-slate-400 text-sm">ETH</span>
        </div>
        <div className="flex gap-2 mt-3">
          {PRESET_AMOUNTS.map((amt) => (
            <button
              key={amt}
              onClick={() => setBetAmount(amt)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                betAmount === amt
                  ? "bg-amber-500 text-slate-950"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              {amt}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => setSelectedSide("HEADS")}
          disabled={isSpinning}
          className={`py-6 rounded-xl border-2 font-bold text-lg transition-all ${
            selectedSide === "HEADS"
              ? "border-amber-500 bg-amber-500/10 text-amber-400"
              : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:bg-slate-800"
          }`}
        >
          <div className="text-2xl mb-1">👑</div>
          HEADS
        </button>
        <button
          onClick={() => setSelectedSide("TAILS")}
          disabled={isSpinning}
          className={`py-6 rounded-xl border-2 font-bold text-lg transition-all ${
            selectedSide === "TAILS"
              ? "border-amber-500 bg-amber-500/10 text-amber-400"
              : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:bg-slate-800"
          }`}
        >
          <div className="text-2xl mb-1">🦅</div>
          TAILS
        </button>
      </div>

      <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Client Seed</span>
          <button
            onClick={() => setClientSeed(Math.random().toString(36).substring(2, 15))}
            className="text-xs text-amber-400 hover:text-amber-300"
          >
            Regenerate
          </button>
        </div>
        <code className="text-xs text-slate-400 font-mono break-all">{clientSeed}</code>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <Button
        onClick={handleBet}
        disabled={isSpinning}
        className="w-full py-6 text-lg font-bold bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 rounded-xl shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
      >
        {isSpinning ? (
          <span className="flex items-center gap-2">
            <Zap className="w-5 h-5 animate-pulse" /> Flipping...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Zap className="w-5 h-5" /> FLIP COIN
          </span>
        )}
      </Button>

      <div className="text-center text-sm text-slate-500">
        Balance: <span className="text-amber-400 font-medium">{balance} ETH</span>
      </div>
    </div>
  );
}
