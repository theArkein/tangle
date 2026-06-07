import type { PowerUpDefinition } from "./types";

export const LETTER_BOMB: PowerUpDefinition = {
  id: "letterBomb",
  name: "Letter Bomb",
  category: "offensive",
  rarity: "common",
  description: "Force opponent's next word to contain Q, X, Z, or J.",
};

export const HARD_LETTERS = ["Q", "X", "Z", "J"] as const;

export function pickHardLetter(rng: () => number = Math.random): string {
  return HARD_LETTERS[Math.floor(rng() * HARD_LETTERS.length)] ?? "Q";
}

export function wordContainsRequired(word: string, requiredLetter: string): boolean {
  return word.toUpperCase().includes(requiredLetter.toUpperCase());
}
