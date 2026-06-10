export type Title =
  | "Apprentice"
  | "Word Slinger"
  | "Chain Forger"
  | "Wordsmith"
  | "Chain Lord"
  | "Lexicon";

interface Tier {
  title: Title;
  winsRequired: number;
}

// Ordered ascending by winsRequired.
const TIERS: Tier[] = [
  { title: "Apprentice", winsRequired: 0 },
  { title: "Word Slinger", winsRequired: 10 },
  { title: "Chain Forger", winsRequired: 50 },
  { title: "Wordsmith", winsRequired: 200 },
  { title: "Chain Lord", winsRequired: 500 },
  { title: "Lexicon", winsRequired: 1000 },
];

export function titleForWins(totalWins: number): Title {
  let current: Title = "Apprentice";
  for (const tier of TIERS) {
    if (totalWins >= tier.winsRequired) current = tier.title;
  }
  return current;
}

export interface TitleProgress {
  current: Title;
  next?: Title;
  winsToNext?: number;
}

export function titleProgress(totalWins: number): TitleProgress {
  const current = titleForWins(totalWins);
  const currentIdx = TIERS.findIndex((t) => t.title === current);
  const nextTier = TIERS[currentIdx + 1];
  if (!nextTier) return { current };
  return {
    current,
    next: nextTier.title,
    winsToNext: Math.max(0, nextTier.winsRequired - totalWins),
  };
}
