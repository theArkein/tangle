export interface ScoreBreakdown {
  base: number;
  rareLetter: number;
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
  const base = word.length;

  const rareSet = new Set<string>();
  for (const ch of word.toUpperCase()) {
    if (ch === "Q" || ch === "X" || ch === "Z" || ch === "J") {
      rareSet.add(ch);
    }
  }
  const rareLetter = rareSet.size;

  const longWord = word.length >= 8 ? 5 : 0;

  const multiplier = options.multiplier ?? 1;
  const subtotal = base + rareLetter + longWord;
  const points = subtotal * multiplier;

  return {
    points,
    breakdown: { base, rareLetter, longWord },
    multiplier,
  };
}
