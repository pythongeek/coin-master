"use client";

import { useGameStore } from "@/stores/gameStore";
import { Trophy, ArrowLeftRight } from "lucide-react";

export default function BetHistory() {
  const { betHistory } = useGameStore();

  if (betHistory.length === 0) {
    return (
      <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-700/30 text-center">
        <p className="text-slate-500 text-sm">No bets yet. Place your first bet!</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700/30">
        <h3 className="text-sm font-medium text-slate-300">Recent Bets</h3>
      </div>
      <div className="divide-y divide-slate-700/30">
        {betHistory.map((bet) => (
          <div
            key={bet.id}
            className="px-4 py-3 flex items-center justify-between hover:bg-slate-700/20 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  bet.won
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {bet.won ? <Trophy className="w-4 h-4" /> : <ArrowLeftRight className="w-4 h-4" />}
              </div>
              <div>
                <div className="text-sm text-white">
                  {bet.prediction} → {bet.outcome}
                </div>
                <div className="text-xs text-slate-500">
                  {new Date(bet.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-sm font-medium ${bet.won ? "text-green-400" : "text-red-400"}`}>
                {bet.won ? "+" : "-"}
                {bet.won ? bet.payout : bet.amount} ETH
              </div>
              <div className="text-xs text-slate-500">{bet.amount} ETH bet</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
