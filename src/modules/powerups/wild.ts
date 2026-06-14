import type { PowerUpDefinition } from "./types";

export const WILD: PowerUpDefinition = {
  id: "wild",
  name: "Wild",
  category: "disruption",
  rarity: "common",
  description: "Your next word can start with any letter, ignoring the chain rule.",
  // Note: Earned by playing words where first and last letters match (e.g., eagle, yearly)
};
