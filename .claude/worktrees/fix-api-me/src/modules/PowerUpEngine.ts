import {
  REGISTRY,
  getDefinition,
  FREEZE_DURATION_MS,
  pickHardLetter,
} from "./powerups";
import {
  pickFromCategory,
  TRIGGER_CATEGORY,
  SCORE_THRESHOLD_POINTS,
  type DropSource,
} from "./powerups/pools";
import type {
  ActiveEffect,
  DropTriggers,
  PlayerId,
  PowerUpDrop,
  PowerUpId,
  PowerUpInventory,
  ScoreBreakdown,
} from "./powerups/types";
import { emptyInventory } from "./powerups/types";

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

export interface EvaluateDropsInput {
  playerId: PlayerId;
  prevRoundScore: number;
  newRoundScore: number;
  breakdown: ScoreBreakdown;
  triggers: DropTriggers;
  rng?: () => number;
}

export interface EvaluateDropsResult {
  drops: PowerUpDrop[];
  triggers: DropTriggers;
}

// Returns drops earned by this word along with the updated trigger state.
// Pure — does not mutate inputs.
export function evaluateDrops(input: EvaluateDropsInput): EvaluateDropsResult {
  const { playerId, prevRoundScore, newRoundScore, breakdown, triggers } = input;
  const rng = input.rng ?? Math.random;

  const drops: PowerUpDrop[] = [];
  const nextTriggers: DropTriggers = {
    thresholdsCrossed: { ...triggers.thresholdsCrossed },
    rareLetterDropped: { ...triggers.rareLetterDropped },
    longWordDropped: { ...triggers.longWordDropped },
  };

  // 1) Score threshold crossings (can be multiple from a single word).
  const prevThreshold = Math.floor(prevRoundScore / SCORE_THRESHOLD_POINTS);
  const newThreshold = Math.floor(newRoundScore / SCORE_THRESHOLD_POINTS);
  const crossings = Math.max(0, newThreshold - prevThreshold);
  for (let i = 0; i < crossings; i++) {
    const def = pickFromCategory(TRIGGER_CATEGORY.score_threshold, rng);
    if (def) drops.push({ playerId, id: def.id, source: "score_threshold" });
  }
  if (crossings > 0) {
    nextTriggers.thresholdsCrossed[playerId] = newThreshold;
  }

  // 2) First rare-letter word in the round (once per player).
  if (breakdown.rareLetter > 0 && !triggers.rareLetterDropped[playerId]) {
    const def = pickFromCategory(TRIGGER_CATEGORY.rare_letter, rng);
    if (def) drops.push({ playerId, id: def.id, source: "rare_letter" });
    nextTriggers.rareLetterDropped[playerId] = true;
  }

  // 3) First 8+ letter word in the round (once per player).
  if (breakdown.longWord > 0 && !triggers.longWordDropped[playerId]) {
    const def = pickFromCategory(TRIGGER_CATEGORY.long_word, rng);
    if (def) drops.push({ playerId, id: def.id, source: "long_word" });
    nextTriggers.longWordDropped[playerId] = true;
  }

  return { drops, triggers: nextTriggers };
}

export function addToInventory(
  inventory: PowerUpInventory,
  id: PowerUpId
): PowerUpInventory {
  return { ...inventory, [id]: (inventory[id] ?? 0) + 1 };
}

export type ActivateError =
  | "not_in_inventory"
  | "unknown_powerup"
  | "wrong_turn"
  | "no_word_to_block";

export interface ActivateInput {
  inventory: PowerUpInventory;
  activeEffects: ActiveEffect[];
  powerUpId: PowerUpId;
  byPlayerId: PlayerId;
  opponentId: PlayerId;
  now: number;
  rng?: () => number;
}

export interface ActivateResult {
  inventory: PowerUpInventory;
  activeEffects: ActiveEffect[];
  error?: ActivateError | undefined;
  effect?: ActiveEffect | undefined;
}

// Pure dispatcher. Returns the updated inventory + active effects.
// Side effects (like Block consuming an opponent's last word, which mutates the chain)
// are surfaced via the returned `effect` so the caller can apply them.
export function activate(input: ActivateInput): ActivateResult {
  const { inventory, activeEffects, powerUpId, byPlayerId, opponentId, now } = input;

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

  switch (powerUpId) {
    case "freeze": {
      effect = {
        kind: "freeze",
        onPlayerId: opponentId,
        expiresAt: now + FREEZE_DURATION_MS,
      };
      nextEffects = [...activeEffects.filter((e) => e.kind !== "freeze"), effect];
      break;
    }
    case "secondLife": {
      // Arms the activator (themselves) — consumed by a future timeout.
      effect = { kind: "secondLifeArmed", forPlayerId: byPlayerId };
      nextEffects = [
        ...activeEffects.filter(
          (e) => !(e.kind === "secondLifeArmed" && e.forPlayerId === byPlayerId)
        ),
        effect,
      ];
      break;
    }
    case "letterBomb": {
      const rng = input.rng ?? Math.random;
      effect = {
        kind: "letterBomb",
        onPlayerId: opponentId,
        requiredLetter: pickHardLetter(rng),
      };
      nextEffects = [
        ...activeEffects.filter(
          (e) => !(e.kind === "letterBomb" && e.onPlayerId === opponentId)
        ),
        effect,
      ];
      break;
    }
    case "block": {
      // Block consumes the opponent's last word. The actual chain mutation
      // happens in GameRoom which has access to the chain — we just surface
      // the effect here. No persistent active effect.
      effect = undefined;
      // Caller checks the returned effect for `block` semantics indirectly —
      // we return effect=undefined and rely on the caller to recognize the
      // powerUpId. Inventory has been decremented.
      break;
    }
  }

  return { inventory: nextInventory, activeEffects: nextEffects, effect };
}

// Consumes a Second Life if armed for this player. Returns true if consumed.
export function consumeSecondLifeOnTimeout(
  activeEffects: ActiveEffect[],
  playerId: PlayerId
): { consumed: boolean; activeEffects: ActiveEffect[] } {
  const idx = activeEffects.findIndex(
    (e) => e.kind === "secondLifeArmed" && e.forPlayerId === playerId
  );
  if (idx < 0) return { consumed: false, activeEffects };
  const next = [...activeEffects];
  next.splice(idx, 1);
  return { consumed: true, activeEffects: next };
}

// Consumes the Letter Bomb constraint after the opponent's turn is decided
// (whether they satisfied it or not — bomb lasts exactly one turn).
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

// Returns the active Letter Bomb requirement for a player, if any.
export function getLetterBombRequirement(
  activeEffects: ActiveEffect[],
  playerId: PlayerId
): string | undefined {
  const e = activeEffects.find(
    (e) => e.kind === "letterBomb" && e.onPlayerId === playerId
  );
  return e?.kind === "letterBomb" ? e.requiredLetter : undefined;
}

// Returns the freeze-expiry timestamp for a player, if any.
export function getFreezeExpiresAt(
  activeEffects: ActiveEffect[],
  playerId: PlayerId
): number | undefined {
  const e = activeEffects.find(
    (e) => e.kind === "freeze" && e.onPlayerId === playerId
  );
  return e?.kind === "freeze" ? e.expiresAt : undefined;
}

// Drops expired effects.
export function tickEffects(activeEffects: ActiveEffect[], now: number): ActiveEffect[] {
  return activeEffects.filter((e) => {
    if (e.kind === "freeze") return e.expiresAt > now;
    return true;
  });
}
