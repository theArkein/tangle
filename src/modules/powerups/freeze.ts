import type { PowerUpDefinition } from "./types";

export const EXTEND: PowerUpDefinition = {
  id: "extend",
  name: "Extend",
  category: "defensive",
  rarity: "common",
  description: "Add 5 seconds to your own turn timer.",
};

export const EXTEND_DELTA_MS = 5_000;
