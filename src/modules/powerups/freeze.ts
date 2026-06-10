import type { PowerUpDefinition } from "./types";

export const FREEZE: PowerUpDefinition = {
  id: "freeze",
  name: "Freeze",
  category: "defensive",
  rarity: "common",
  description: "Add 5 seconds to your own turn timer.",
};

export const FREEZE_EXTENSION_MS = 5_000;
