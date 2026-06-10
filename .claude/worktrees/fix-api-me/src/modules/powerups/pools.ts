import { definitionsForCategory } from "./index";
import type { Category, PowerUpDefinition, Rarity } from "./types";

// Trigger → category mapping. Each earning trigger draws from a specific
// thematic pool. Adding a new trigger = appending one row.
export type DropSource = "score_threshold" | "rare_letter" | "long_word";

export const TRIGGER_CATEGORY: Record<DropSource, Category> = {
  score_threshold: "defensive",
  rare_letter: "offensive",
  long_word: "offensive",
};

// Rarity weights within a pool. Forward-compatible: in Phase 1 every
// definition is `common`, so this is effectively a no-op.
export const RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 60,
  uncommon: 30,
  rare: 10,
};

// Pure: pick one definition from the given category, weighted by rarity.
// Returns undefined if the category is empty.
export function pickFromCategory(
  category: Category,
  rng: () => number
): PowerUpDefinition | undefined {
  const pool = definitionsForCategory(category);
  if (pool.length === 0) return undefined;

  const totalWeight = pool.reduce(
    (sum, def) => sum + (RARITY_WEIGHTS[def.rarity] ?? 0),
    0
  );
  if (totalWeight === 0) return pool[0];

  let roll = rng() * totalWeight;
  for (const def of pool) {
    roll -= RARITY_WEIGHTS[def.rarity] ?? 0;
    if (roll <= 0) return def;
  }
  return pool[pool.length - 1];
}

// Score threshold for a drop. Tunable.
export const SCORE_THRESHOLD_POINTS = 15;
