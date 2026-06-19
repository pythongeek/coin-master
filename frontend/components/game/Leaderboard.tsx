"use client";

import { useState, useEffect } from "react";
import { Trophy, Clock, Users } from "lucide-react";

type Tab = "daily" | "weekly" | "squads";

interface LeaderboardEntry {
  rank: number;
  userId?: string;
  username: string;
  avatarUrl?: string;
  totalWon: string;
  betsWon: number;
}

interface SquadEntry {
  id: string;
  name: string;
  totalPayout: string;
  memberCount: number;
}

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState<Tab>("daily");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [squadEntries, setSquadEntries] = useState<SquadEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Mock data for demo
  const mockDaily: LeaderboardEntry[] = [
    { rank: 1, username: "CryptoKing", totalWon: "2.45", betsWon: 12 },
    { rank: 2, username: "FlipMaster", totalWon: "1.87", betsWon: 8 },
    { rank: 3, username: "LuckyStar", totalWon: "1.32", betsWon: 6 },
    { rank: 4, username: "CoinHunter", totalWon: "0.98", betsWon: 5 },
    { rank: 5, username: "RainMaker", totalWon: "0.76", betsWon: 4 },
  ];

  const mockSquads: SquadEntry[] = [
    { id: "1", name: "Moon Squad", totalPayout: "5.2", memberCount: 5 },
    { id: "2", name: "Diamond Hands", totalPayout: "3.8", memberCount: 3 },
    { id: "3", name: "Whale Crew", totalPayout: "2.1", memberCount: 4 },
  ];

  useEffect(() => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      if (activeTab === "squads") {
        setSquadEntries(mockSquads);
      } else {
        setEntries(mockDaily);
      }
      setLoading(false);
    }, 300);
  }, [activeTab]);

  const rankColor = (rank: number) => {
    if (rank === 1) return "text-amber-400";
    if (rank === 2) return "text-slate-300";
    if (rank === 3) return "text-amber-600";
    return "text-slate-500";
  };

  const rankBg = (rank: number) => {
    if (rank === 1) return "bg-amber-500/10 border-amber-500/20";
    if (rank === 2) return "bg-slate-500/10 border-slate-500/20";
    if (rank === 3) return "bg-amber-700/10 border-amber-700/20";
    return "bg-slate-800/30 border-transparent";
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-medium text-slate-300">Leaderboard</h3>
        </div>
        <div className="flex gap-1">
          {(["daily", "weekly", "squads"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors capitalize ${
                activeTab === tab
                  ? "bg-amber-500/20 text-amber-400"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {tab === "daily" && <Clock className="w-3 h-3 inline mr-1" />}
              {tab === "squads" && <Users className="w-3 h-3 inline mr-1" />}
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="p-2">
        {loading ? (
          <div className="text-center py-6 text-slate-600 text-sm">Loading...</div>
        ) : activeTab === "squads" ? (
          <div className="space-y-1">
            {squadEntries.map((squad, i) => (
              <div
                key={squad.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${rankBg(i + 1)}`}
              >
                <span className={`text-sm font-bold w-5 ${rankColor(i + 1)}`}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{squad.name}</div>
                  <div className="text-xs text-slate-500">{squad.memberCount} members</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-amber-400">{squad.totalPayout} ETH</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {entries.map((entry) => (
              <div
                key={entry.rank}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${rankBg(entry.rank)}`}
              >
                <span className={`text-sm font-bold w-5 ${rankColor(entry.rank)}`}>
                  {entry.rank}
                </span>
                <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-300 font-bold">
                  {entry.username[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{entry.username}</div>
                  <div className="text-xs text-slate-500">{entry.betsWon} wins</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-green-400">+{entry.totalWon} ETH</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
