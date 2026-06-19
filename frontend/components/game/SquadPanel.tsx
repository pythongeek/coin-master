"use client";

import { useState } from "react";
import { Users, Plus, LogIn, Lock, Crown, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Squad {
  id: string;
  name: string;
  status: string;
  targetAmount: string;
  collectedAmount: string;
  memberCount: number;
  maxMembers: number;
  predictedOutcome: string;
}

export default function SquadPanel() {
  const [squads, setSquads] = useState<Squad[]>([
    {
      id: "demo-1",
      name: "Moon Squad",
      status: "FORMING",
      targetAmount: "1.0",
      collectedAmount: "0.3",
      memberCount: 2,
      maxMembers: 5,
      predictedOutcome: "HEADS",
    },
    {
      id: "demo-2",
      name: "Diamond Hands",
      status: "FORMING",
      targetAmount: "0.5",
      collectedAmount: "0.1",
      memberCount: 1,
      maxMembers: 3,
      predictedOutcome: "TAILS",
    },
  ]);
  const [showCreate, setShowCreate] = useState(false);
  const [newSquadName, setNewSquadName] = useState("");
  const [newSquadTarget, setNewSquadTarget] = useState("0.1");
  const [newSquadSide, setNewSquadSide] = useState<"HEADS" | "TAILS">("HEADS");
  const [activeTab, setActiveTab] = useState<"list" | "create">("list");

  const handleCreate = () => {
    if (!newSquadName.trim()) return;
    const squad: Squad = {
      id: `squad-${Date.now()}`,
      name: newSquadName,
      status: "FORMING",
      targetAmount: newSquadTarget,
      collectedAmount: "0",
      memberCount: 1,
      maxMembers: 5,
      predictedOutcome: newSquadSide,
    };
    setSquads([squad, ...squads]);
    setNewSquadName("");
    setActiveTab("list");
  };

  const handleJoin = (squadId: string) => {
    setSquads(squads.map(s => s.id === squadId ? { ...s, memberCount: s.memberCount + 1 } : s));
  };

  const progress = (collected: string, target: string) => {
    const c = parseFloat(collected);
    const t = parseFloat(target);
    return Math.min((c / t) * 100, 100);
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-medium text-slate-300">Squads</h3>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("list")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              activeTab === "list" ? "bg-amber-500/20 text-amber-400" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            List
          </button>
          <button
            onClick={() => setActiveTab("create")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              activeTab === "create" ? "bg-amber-500/20 text-amber-400" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Plus className="w-3 h-3 inline" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === "list" ? (
          <div className="space-y-3">
            {squads.length === 0 && (
              <p className="text-center text-slate-600 text-sm py-4">
                No active squads. Create one!
              </p>
            )}
            {squads.map((squad) => (
              <div
                key={squad.id}
                className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30 hover:border-slate-600/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-medium text-white">{squad.name}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    squad.status === "FORMING"
                      ? "bg-blue-500/20 text-blue-400"
                      : squad.status === "ACTIVE"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-slate-700/50 text-slate-400"
                  }`}>
                    {squad.status}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-500 mb-2">
                  <span className="flex items-center gap-1">
                    <Coins className="w-3 h-3" />
                    {squad.collectedAmount} / {squad.targetAmount} ETH
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {squad.memberCount} / {squad.maxMembers}
                  </span>
                  <span className="text-amber-400 font-medium">
                    {squad.predictedOutcome}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-700/50 rounded-full h-1.5 mb-3">
                  <div
                    className="bg-amber-500 rounded-full h-1.5 transition-all"
                    style={{ width: `${progress(squad.collectedAmount, squad.targetAmount)}%` }}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700 text-xs"
                    onClick={() => handleJoin(squad.id)}
                    disabled={squad.memberCount >= squad.maxMembers}
                  >
                    <LogIn className="w-3 h-3 mr-1" /> Join
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs"
                    disabled={squad.memberCount < 2}
                  >
                    <Lock className="w-3 h-3 mr-1" /> Lock
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Squad Name</label>
              <input
                type="text"
                value={newSquadName}
                onChange={(e) => setNewSquadName(e.target.value)}
                placeholder="e.g., Moon Squad"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Target Amount (ETH)</label>
              <input
                type="number"
                step="0.01"
                value={newSquadTarget}
                onChange={(e) => setNewSquadTarget(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Prediction</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setNewSquadSide("HEADS")}
                  className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                    newSquadSide === "HEADS"
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      : "bg-slate-700/50 text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  👑 HEADS
                </button>
                <button
                  onClick={() => setNewSquadSide("TAILS")}
                  className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                    newSquadSide === "TAILS"
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      : "bg-slate-700/50 text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  🦅 TAILS
                </button>
              </div>
            </div>
            <Button
              onClick={handleCreate}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
            >
              <Plus className="w-4 h-4 mr-1" /> Create Squad
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
