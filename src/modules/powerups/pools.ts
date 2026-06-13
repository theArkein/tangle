// Chain length at which the Danger Zone begins (6 words each = 12 total).
export const DANGER_ZONE_CHAIN_THRESHOLD = 12;

// Score multiplier applied to all words in the Danger Zone.
export const DANGER_ZONE_MULTIPLIER = 2;

// Timer in milliseconds during the Danger Zone.
export const DANGER_ZONE_TIMER_MS = 10_000;

// Rare letter tiers used by ScoringEngine and PowerUpEngine trigger evaluation.
export const RARE_TIER_1 = new Set(["Q", "X", "Z", "J"]);
export const RARE_TIER_2 = new Set(["V", "K", "W"]);
export const RARE_TIER_3 = new Set(["F", "H", "Y", "B"]);
