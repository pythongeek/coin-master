"use client";

import { useEffect } from "react";
import { useGameStore } from "@/stores/gameStore";

export function SoundManager() {
  const { isSpinning, won, lastResult } = useGameStore();

  useEffect(() => {
    if (isSpinning) {
      console.log("🔊 Spin sound would play");
    }
  }, [isSpinning]);

  useEffect(() => {
    if (lastResult && !isSpinning) {
      if (won) {
        console.log("🔊 Win sound would play");
      } else {
        console.log("🔊 Loss sound would play");
      }
    }
  }, [lastResult, won, isSpinning]);

  return null;
}

export default SoundManager;
