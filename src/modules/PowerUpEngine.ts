import { getDefinition, pickHardLetter } from "./powerups";
import { RARE_TIER_1, RARE_TIER_2, RARE_TIER_3 } from "./powerups/pools";
import type {
  ActiveEffect,
  DropTriggers,
  PlayerId,
  PowerUpDrop,
  PowerUpId,
  PowerUpInventory,
} from "./powerups/types";
import { emptyInventory } from "./powerups/types";
import type { ScoreResult } from "./ScoringEngine";

export type {
  ActiveEffect,
  DropTriggers,
  PlayerId,
  PowerUpDrop,
  PowerUpId,
  PowerUpInventory,
} from "./powerups/types";

export { emptyInventory, emptyTriggers } from "./powerups/types";
export { REGISTRY, getDefinition } from "./powerups";

// ---------------------------------------------------------------------------
// Helpers used for Second Life trigger evaluation
// ---------------------------------------------------------------------------

function countUniqueVowels(word: string): number {
  const vowels = new Set<string>();
  for (const ch of word.toLowerCase()) {
    if (ch === "a" || ch === "e" || ch === "i" || ch === "o" || ch === "u") {
      vowels.add(ch);
    }
  }
  return vowels.size;
}

function hasLettersFromMultipleRareTiers(word: string): boolean {
  const upper = word.toUpperCase();
  let hasTier1 = false;
  let hasTier2 = false;
  let hasTier3 = false;
  for (const ch of upper) {
    if (RARE_TIER_1.has(ch)) hasTier1 = true;
    else if (RARE_TIER_2.has(ch)) hasTier2 = true;
    else if (RARE_TIER_3.has(ch)) hasTier3 = true;
  }
  return (hasTier1 && hasTier2) || (hasTier1 && hasTier3) || (hasTier2 && hasTier3);
}

// ---------------------------------------------------------------------------
// evaluateDrops — deterministic trigger evaluation after each valid word
// ---------------------------------------------------------------------------

export interface EvaluateDropsInput {
  playerId: PlayerId;
  opponentId: PlayerId;
  word: string;
  scoreResult: ScoreResult;
  prevRoundScore: number;
  newRoundScore: number;
  triggers: DropTriggers;
  isDangerZone?: boolean;
  justEnteredDangerZone?: boolean;
}

export interface EvaluateDropsResult {
  drops: PowerUpDrop[];
  triggers: DropTriggers;
}

export function evaluateDrops(input: EvaluateDropsInput): EvaluateDropsResult {
  const {
    playerId,
    opponentId,
    word,
    scoreResult,
    prevRoundScore,
    newRoundScore,
    triggers,
    isDangerZone = false,
    justEnteredDangerZone = false,
  } = input;

  const drops: PowerUpDrop[] = [];
  const nextTriggers: DropTriggers = {
    playerFreezeThresholds: { ...triggers.playerFreezeThresholds },
    playerWordCounts: { ...triggers.playerWordCounts },
  };

  // Increment word count before checking Wild trigger
  const prevWordCount = nextTriggers.playerWordCounts[playerId] ?? 0;
  const newWordCount = prevWordCount + 1;
  nextTriggers.playerWordCounts[playerId] = newWordCount;

  // 1. Freeze — every 25-point multiple crossed
  const prevThreshold = Math.floor(prevRoundScore / 25);
  const newThreshold = Math.floor(newRoundScore / 25);
  const crossings = Math.max(0, newThreshold - prevThreshold);
  for (let i = 0; i < crossings; i++) {
    drops.push({ playerId, id: "freeze" });
  }
  if (crossings > 0) {
    nextTriggers.playerFreezeThresholds[playerId] = newThreshold;
  }

  // 2. Double — 10+ letter word
  if (word.length >= 10) {
    drops.push({ playerId, id: "double" });
  }

  // 3. Letter Bomb — word contains Q, X, Z, or J
  const upperWord = word.toUpperCase();
  if ([...upperWord].some((ch) => RARE_TIER_1.has(ch))) {
    drops.push({ playerId, id: "letterBomb" });
  }

  // 4. Anchor — 8+ letter word
  if (word.length >= 8) {
    drops.push({ playerId, id: "anchor" });
  }

  // 5. Tax — any word played in Danger Zone
  if (isDangerZone) {
    drops.push({ playerId, id: "tax" });
  }

  // 6. Wild — every 6th word by this player
  if (newWordCount % 6 === 0) {
    drops.push({ playerId, id: "wild" });
  }

  // 7. Second Life — any of 4 paths
  let earnSecondLife = false;
  if (scoreResult.points >= 15) earnSecondLife = true;
  if (!earnSecondLife && countUniqueVowels(word) >= 4) earnSecondLife = true;
  if (!earnSecondLife && hasLettersFromMultipleRareTiers(word)) earnSecondLife = true;

  if (earnSecondLife) {
    drops.push({ playerId, id: "secondLife" });
  }

  // 8. Danger Zone entry — Second Life to BOTH players
  if (justEnteredDangerZone) {
    drops.push({ playerId, id: "secondLife" });
    drops.push({ playerId: opponentId, id: "secondLife" });
  }

  return { drops, triggers: nextTriggers };
}

// ---------------------------------------------------------------------------
// addToInventory
// ---------------------------------------------------------------------------

export function addToInventory(
  inventory: PowerUpInventory,
  id: PowerUpId
): PowerUpInventory {
  return { ...inventory, [id]: (inventory[id] ?? 0) + 1 };
}

// ---------------------------------------------------------------------------
// activate
// ---------------------------------------------------------------------------

export type ActivateError =
  | "not_in_inventory"
  | "unknown_powerup"
  | "powerups_disabled";

export interface ActivateInput {
  inventory: PowerUpInventory;
  activeEffects: ActiveEffect[];
  powerUpId: PowerUpId;
  byPlayerId: PlayerId;
  opponentId: PlayerId;
  rng?: () => number;
}

export interface ActivateResult {
  inventory: PowerUpInventory;
  activeEffects: ActiveEffect[];
  error?: ActivateError;
  effect?: ActiveEffect;
  // Signals for instant effects — callers act on these
  alarmDeltaMs?: number;  // freeze: extend alarm by this amount
  taxOpponent?: boolean;  // tax: caller deducts 10 from opponent score
}

function withoutEffectsMatching(
  effects: ActiveEffect[],
  predicate: (e: ActiveEffect) => boolean
): ActiveEffect[] {
  return effects.filter((e) => !predicate(e));
}

export function activate(input: ActivateInput): ActivateResult {
  const { inventory, activeEffects, powerUpId, byPlayerId, opponentId } = input;
  const rng = input.rng ?? Math.random;

  if (!getDefinition(powerUpId)) {
    return { inventory, activeEffects, error: "unknown_powerup" };
  }
  if ((inventory[powerUpId] ?? 0) <= 0) {
    return { inventory, activeEffects, error: "not_in_inventory" };
  }

  const nextInventory: PowerUpInventory = {
    ...inventory,
    [powerUpId]: inventory[powerUpId] - 1,
  };

  let effect: ActiveEffect | undefined;
  let nextEffects = activeEffects;
  let alarmDeltaMs: number | undefined;
  let taxOpponent: boolean | undefined;

  switch (powerUpId) {
    case "freeze": {
      // Instant: no persistent effect, caller extends alarm
      alarmDeltaMs = 5_000;
      break;
    }
    case "secondLife": {
      // Instant effect: caller resets the timer and deducts from inventory.
      // No persistent ActiveEffect needed.
      break;
    }
    case "letterBomb": {
      effect = {
        kind: "letterBomb",
        onPlayerId: opponentId,
        requiredLetter: pickHardLetter(rng),
      };
      nextEffects = [
        ...withoutEffectsMatching(
          activeEffects,
          (e) => e.kind === "letterBomb" && e.onPlayerId === opponentId
        ),
        effect,
      ];
      break;
    }
    case "double": {
      effect = { kind: "doubleScore", forPlayerId: byPlayerId, wordsRemaining: 3 };
      nextEffects = [
        ...withoutEffectsMatching(
          activeEffects,
          (e) => e.kind === "doubleScore" && e.forPlayerId === byPlayerId
        ),
        effect,
      ];
      break;
    }
    case "wild": {
      effect = { kind: "wildPending", forPlayerId: byPlayerId };
      nextEffects = [
        ...withoutEffectsMatching(
          activeEffects,
          (e) => e.kind === "wildPending" && e.forPlayerId === byPlayerId
        ),
        effect,
      ];
      break;
    }
    case "anchor": {
      effect = { kind: "anchor", onPlayerId: opponentId, minLength: 6 };
      nextEffects = [
        ...withoutEffectsMatching(
          activeEffects,
          (e) => e.kind === "anchor" && e.onPlayerId === opponentId
        ),
        effect,
      ];
      break;
    }
    case "tax": {
      // Instant: no persistent effect, caller deducts from opponent score
      taxOpponent = true;
      break;
    }
  }

  const result: ActivateResult = { inventory: nextInventory, activeEffects: nextEffects };
  if (effect !== undefined) result.effect = effect;
  if (alarmDeltaMs !== undefined) result.alarmDeltaMs = alarmDeltaMs;
  if (taxOpponent !== undefined) result.taxOpponent = taxOpponent;
  return result;
}

// ---------------------------------------------------------------------------
// Effect query / consume helpers
// ---------------------------------------------------------------------------


export function consumeLetterBomb(
  activeEffects: ActiveEffect[],
  playerId: PlayerId
): { activeEffects: ActiveEffect[]; consumedRequiredLetter?: string } {
  const idx = activeEffects.findIndex(
    (e) => e.kind === "letterBomb" && e.onPlayerId === playerId
  );
  if (idx < 0) return { activeEffects };
  const effect = activeEffects[idx] as Extract<ActiveEffect, { kind: "letterBomb" }>;
  const next = [...activeEffects];
  next.splice(idx, 1);
  return { activeEffects: next, consumedRequiredLetter: effect.requiredLetter };
}

export function getLetterBombRequirement(
  activeEffects: ActiveEffect[],
  playerId: PlayerId
): string | undefined {
  const e = activeEffects.find(
    (e) => e.kind === "letterBomb" && e.onPlayerId === playerId
  );
  return e?.kind === "letterBomb" ? e.requiredLetter : undefined;
}

export function isWildPending(activeEffects: ActiveEffect[], playerId: PlayerId): boolean {
  return activeEffects.some(
    (e) => e.kind === "wildPending" && e.forPlayerId === playerId
  );
}

export function consumeWild(
  activeEffects: ActiveEffect[],
  playerId: PlayerId
): ActiveEffect[] {
  return activeEffects.filter(
    (e) => !(e.kind === "wildPending" && e.forPlayerId === playerId)
  );
}

export function getDoubleScore(
  activeEffects: ActiveEffect[],
  playerId: PlayerId
): Extract<ActiveEffect, { kind: "doubleScore" }> | undefined {
  const e = activeEffects.find(
    (e) => e.kind === "doubleScore" && e.forPlayerId === playerId
  );
  return e?.kind === "doubleScore" ? e : undefined;
}

export function decrementDouble(
  activeEffects: ActiveEffect[],
  playerId: PlayerId
): ActiveEffect[] {
  return activeEffects
    .map((e) =>
      e.kind === "doubleScore" && e.forPlayerId === playerId
        ? { ...e, wordsRemaining: e.wordsRemaining - 1 }
        : e
    )
    .filter((e) => !(e.kind === "doubleScore" && e.wordsRemaining <= 0));
}

export function getAnchor(
  activeEffects: ActiveEffect[],
  playerId: PlayerId
): Extract<ActiveEffect, { kind: "anchor" }> | undefined {
  const e = activeEffects.find(
    (e) => e.kind === "anchor" && e.onPlayerId === playerId
  );
  return e?.kind === "anchor" ? e : undefined;
}

export function consumeAnchor(
  activeEffects: ActiveEffect[],
  playerId: PlayerId
): ActiveEffect[] {
  return activeEffects.filter(
    (e) => !(e.kind === "anchor" && e.onPlayerId === playerId)
  );
}
