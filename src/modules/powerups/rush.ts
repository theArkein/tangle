import type { PowerUpDefinition } from "./types";

export const RUSH: PowerUpDefinition = {
  id: "rush",
  name: "Rush",
  category: "offensive",
  rarity: "uncommon",
  description: "Cut opponent's timer in half for their next turn.",
};

export const RUSH_TIMER_FRACTION = 0.5;
