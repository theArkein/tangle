import type { PowerUpDefinition } from "./types";

export const SHRINK: PowerUpDefinition = {
  id: "shrink",
  name: "Shrink",
  category: "offensive",
  rarity: "uncommon",
  description: "Opponent's next word must be 4 letters or fewer.",
};

export const SHRINK_MAX_LENGTH = 4;
