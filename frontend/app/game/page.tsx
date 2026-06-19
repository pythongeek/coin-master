import GamePanel from "@/components/game/GamePanel";
import BetHistory from "@/components/game/BetHistory";
import SoundManager from "@/components/game/SoundManager";
import ChatBox from "@/components/game/ChatBox";
import SquadPanel from "@/components/game/SquadPanel";
import Leaderboard from "@/components/game/Leaderboard";
import { Shield, Hash, Sparkles } from "lucide-react";

export default function GamePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 py-8 px-4">
      <SoundManager />

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
            CryptoFlip
          </h1>
          <p className="text-slate-400 text-sm">
            Provably Fair • SHA-256 Commitment • Instant Settlement
          </p>
          <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-green-400" /> 98% RTP
            </span>
            <span className="flex items-center gap-1">
              <Hash className="w-3 h-3 text-amber-400" /> HMAC-SHA256
            </span>
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-cyan-400" /> Crypto Rain
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left sidebar - Chat, Squads, Leaderboard */}
          <div className="space-y-6 order-2 lg:order-1">
            <ChatBox />
            <SquadPanel />
            <Leaderboard />
          </div>

          {/* Center - Game */}
          <div className="lg:col-span-2 order-1 lg:order-2">
            <GamePanel />

            {/* How It Works + Bet History below game */}
            <div className="mt-6 space-y-6">
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <h3 className="text-sm font-medium text-slate-300 mb-3">How It Works</h3>
                <ol className="space-y-2 text-sm text-slate-400">
                  <li className="flex gap-2">
                    <span className="text-amber-400 font-bold">1.</span>
                    Server generates a secret seed and publishes its hash
                  </li>
                  <li className="flex gap-2">
                    <span className="text-amber-400 font-bold">2.</span>
                    You provide a client seed and choose a side
                  </li>
                  <li className="flex gap-2">
                    <span className="text-amber-400 font-bold">3.</span>
                    HMAC-SHA256(serverSeed, clientSeed + nonce) determines the outcome
                  </li>
                  <li className="flex gap-2">
                    <span className="text-amber-400 font-bold">4.</span>
                    Server reveals the seed after rotation for verification
                  </li>
                </ol>
              </div>
              <BetHistory />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
