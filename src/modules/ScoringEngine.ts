export interface ScoreBreakdown {
  base: number;
  rareLetter: number;
  longWord: number;
}

export interface ScoreResult {
  points: number;
  breakdown: ScoreBreakdown;
}

export function score(word: string): ScoreResult {
  const base = word.length;

  const rareSet = new Set<string>();
  for (const ch of word.toUpperCase()) {
    if (ch === "Q" || ch === "X" || ch === "Z" || ch === "J") {
      rareSet.add(ch);
    }
  }
  const rareLetter = rareSet.size;

  const longWord = word.length >= 8 ? 5 : 0;

  const points = base + rareLetter + longWord;

  return {
    points,
    breakdown: { base, rareLetter, longWord },
  };
}
