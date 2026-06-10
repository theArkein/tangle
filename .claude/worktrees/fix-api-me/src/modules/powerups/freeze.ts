import type { PowerUpDefinition } from "./types";

export const FREEZE: PowerUpDefinition = {
  id: "freeze",
  name: "Freeze",
  category: "defensive",
  rarity: "common",
  description: "Pause your opponent's timer for 5 seconds.",
};

export const FREEZE_DURATION_MS = 5_000;
