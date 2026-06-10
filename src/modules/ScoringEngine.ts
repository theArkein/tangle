import { RARE_TIER_1, RARE_TIER_2, RARE_TIER_3 } from "./powerups/pools";

export interface ScoreBreakdown {
  base: number;
  rareTier1: number;
  rareTier2: number;
  rareTier3: number;
  longWord: number;
}

export interface ScoreResult {
  points: number;
  breakdown: ScoreBreakdown;
  multiplier: number;
}

export interface ScoreOptions {
  multiplier?: number;
}

export function score(word: string, options: ScoreOptions = {}): ScoreResult {
  const upper = word.toUpperCase();
  const base = word.length;

  let tier1 = 0;
  let tier2 = 0;
  let tier3 = 0;
  for (const ch of upper) {
    if (RARE_TIER_1.has(ch)) tier1 += 3;
    else if (RARE_TIER_2.has(ch)) tier2 += 2;
    else if (RARE_TIER_3.has(ch)) tier3 += 1;
  }

  const longWord = word.length >= 8 ? 5 : 0;

  const multiplier = options.multiplier ?? 1;
  const subtotal = base + tier1 + tier2 + tier3 + longWord;
  const points = subtotal * multiplier;

  return {
    points,
    breakdown: { base, rareTier1: tier1, rareTier2: tier2, rareTier3: tier3, longWord },
    multiplier,
  };
}
