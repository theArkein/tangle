import {
  REGISTRY,
  getDefinition,
  FREEZE_DURATION_MS,
  pickHardLetter,
  BLIND_TURNS,
  SHRINK_MAX_LENGTH,
  PEEK_TURNS,
  WILDFIRE_MULTIPLIER,
  WILDFIRE_TURNS,
} from "./powerups";
import {
  pickFromCategory,
  TRIGGER_CATEGORY,
  SCORE_THRESHOLD_POINTS,
  CHAIN_LENGTH_THRESHOLD,
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
  chainLength?: number;
  isDangerZone?: boolean;
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
  const chainLength = input.chainLength ?? 0;
  const isDangerZone = input.isDangerZone ?? false;
  const rng = input.rng ?? Math.random;

  const drops: PowerUpDrop[] = [];
  const nextTriggers: DropTriggers = {
    thresholdsCrossed: { ...triggers.thresholdsCrossed },
    rareLetterDropped: { ...triggers.rareLetterDropped },
    longWordDropped: { ...triggers.longWordDropped },
    chainLengthDropped: { ...triggers.chainLengthDropped },
    dangerZoneDropped: triggers.dangerZoneDropped,
  };

  // 1) Score threshold crossings — suppressed in the Danger Zone to prevent
  //    power-up flooding from the 3× multiplier accelerating every threshold.
  if (!isDangerZone) {
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

  // 4) Chain reaches 10+ words for the first time this round (once per player).
  if (
    chainLength >= CHAIN_LENGTH_THRESHOLD &&
    !triggers.chainLengthDropped[playerId]
  ) {
    const def = pickFromCategory(TRIGGER_CATEGORY.chain_length, rng);
    if (def) drops.push({ playerId, id: def.id, source: "chain_length" });
    nextTriggers.chainLengthDropped[playerId] = true;
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
  | "no_word_to_block"
  | "powerups_disabled";

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

function withoutEffectsMatching(
  effects: ActiveEffect[],
  predicate: (e: ActiveEffect) => boolean
): ActiveEffect[] {
  return effects.filter((e) => !predicate(e));
}

// Pure dispatcher. Returns the updated inventory + active effects.
// Side-effecting power-ups (Block, Steal, Swap, Blitz) surface their semantics
// via the returned `effect` or the registered ActiveEffect; the caller (GameRoom)
// performs the chain mutation / turn-skip / etc.
export function activate(input: ActivateInput): ActivateResult {
  const { inventory, activeEffects, powerUpId, byPlayerId, opponentId, now } = input;
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

  switch (powerUpId) {
    case "freeze": {
      effect = {
        kind: "freeze",
        onPlayerId: opponentId,
        expiresAt: now + FREEZE_DURATION_MS,
      };
      nextEffects = [
        ...withoutEffectsMatching(activeEffects, (e) => e.kind === "freeze" && e.onPlayerId === opponentId),
        effect,
      ];
      break;
    }
    case "secondLife": {
      effect = { kind: "secondLifeArmed", forPlayerId: byPlayerId };
      nextEffects = [
        ...withoutEffectsMatching(
          activeEffects,
          (e) => e.kind === "secondLifeArmed" && e.forPlayerId === byPlayerId
        ),
        effect,
      ];
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
    case "block": {
      // Block consumes the opponent's last word. Chain mutation happens in
      // GameRoom; no persistent active effect.
      effect = undefined;
      break;
    }
    case "swap": {
      // Swap is a two-step activation: first arms a pending swap waiting for the
      // user to choose a letter; GameRoom then drives the second message
      // (swap_choose_letter) which applies the new seed letter directly.
      effect = { kind: "swapPending", byPlayerId };
      nextEffects = [
        ...withoutEffectsMatching(
          activeEffects,
          (e) => e.kind === "swapPending" && e.byPlayerId === byPlayerId
        ),
        effect,
      ];
      break;
    }
    case "blind": {
      effect = { kind: "blind", onPlayerId: opponentId, turnsRemaining: BLIND_TURNS };
      nextEffects = [
        ...withoutEffectsMatching(
          activeEffects,
          (e) => e.kind === "blind" && e.onPlayerId === opponentId
        ),
        effect,
      ];
      break;
    }
    case "shrink": {
      effect = { kind: "shrink", onPlayerId: opponentId, maxLength: SHRINK_MAX_LENGTH };
      nextEffects = [
        ...withoutEffectsMatching(
          activeEffects,
          (e) => e.kind === "shrink" && e.onPlayerId === opponentId
        ),
        effect,
      ];
      break;
    }
    case "rush": {
      effect = { kind: "rush", onPlayerId: opponentId };
      nextEffects = [
        ...withoutEffectsMatching(
          activeEffects,
          (e) => e.kind === "rush" && e.onPlayerId === opponentId
        ),
        effect,
      ];
      break;
    }
    case "steal": {
      // Steal consumes opponent's last word + transfers points. Chain mutation
      // happens in GameRoom; no persistent active effect.
      effect = undefined;
      break;
    }
    case "peek": {
      effect = { kind: "peek", forPlayerId: byPlayerId, turnsRemaining: PEEK_TURNS };
      nextEffects = [
        ...withoutEffectsMatching(
          activeEffects,
          (e) => e.kind === "peek" && e.forPlayerId === byPlayerId
        ),
        effect,
      ];
      break;
    }
    case "blitz": {
      effect = { kind: "blitzClaimed", byPlayerId };
      nextEffects = [
        ...withoutEffectsMatching(
          activeEffects,
          (e) => e.kind === "blitzClaimed" && e.byPlayerId === byPlayerId
        ),
        effect,
      ];
      break;
    }
    case "wildfire": {
      effect = {
        kind: "wildfire",
        turnsRemaining: WILDFIRE_TURNS,
        multiplier: WILDFIRE_MULTIPLIER,
      };
      nextEffects = [
        ...withoutEffectsMatching(activeEffects, (e) => e.kind === "wildfire"),
        effect,
      ];
      break;
    }
  }

  return { inventory: nextInventory, activeEffects: nextEffects, effect };
}

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

export function consumeShrink(
  activeEffects: ActiveEffect[],
  playerId: PlayerId
): { activeEffects: ActiveEffect[]; consumedMaxLength?: number } {
  const idx = activeEffects.findIndex(
    (e) => e.kind === "shrink" && e.onPlayerId === playerId
  );
  if (idx < 0) return { activeEffects };
  const e = activeEffects[idx] as Extract<ActiveEffect, { kind: "shrink" }>;
  const next = [...activeEffects];
  next.splice(idx, 1);
  return { activeEffects: next, consumedMaxLength: e.maxLength };
}

export function consumeRush(
  activeEffects: ActiveEffect[],
  playerId: PlayerId
): { activeEffects: ActiveEffect[]; consumed: boolean } {
  const idx = activeEffects.findIndex(
    (e) => e.kind === "rush" && e.onPlayerId === playerId
  );
  if (idx < 0) return { activeEffects, consumed: false };
  const next = [...activeEffects];
  next.splice(idx, 1);
  return { activeEffects: next, consumed: true };
}

export function decrementBlind(activeEffects: ActiveEffect[]): ActiveEffect[] {
  return activeEffects
    .map((e) =>
      e.kind === "blind"
        ? { ...e, turnsRemaining: e.turnsRemaining - 1 }
        : e
    )
    .filter((e) => !(e.kind === "blind" && e.turnsRemaining <= 0));
}

export function decrementPeek(activeEffects: ActiveEffect[]): ActiveEffect[] {
  return activeEffects
    .map((e) =>
      e.kind === "peek"
        ? { ...e, turnsRemaining: e.turnsRemaining - 1 }
        : e
    )
    .filter((e) => !(e.kind === "peek" && e.turnsRemaining <= 0));
}

export function decrementWildfire(activeEffects: ActiveEffect[]): ActiveEffect[] {
  return activeEffects
    .map((e) =>
      e.kind === "wildfire"
        ? { ...e, turnsRemaining: e.turnsRemaining - 1 }
        : e
    )
    .filter((e) => !(e.kind === "wildfire" && e.turnsRemaining <= 0));
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

export function getShrinkMaxLength(
  activeEffects: ActiveEffect[],
  playerId: PlayerId
): number | undefined {
  const e = activeEffects.find(
    (e) => e.kind === "shrink" && e.onPlayerId === playerId
  );
  return e?.kind === "shrink" ? e.maxLength : undefined;
}

export function isBlinded(activeEffects: ActiveEffect[], playerId: PlayerId): boolean {
  return activeEffects.some(
    (e) => e.kind === "blind" && e.onPlayerId === playerId && e.turnsRemaining > 0
  );
}

export function isPeekActive(activeEffects: ActiveEffect[], playerId: PlayerId): boolean {
  return activeEffects.some(
    (e) => e.kind === "peek" && e.forPlayerId === playerId && e.turnsRemaining > 0
  );
}

export function getWildfireMultiplier(activeEffects: ActiveEffect[]): number {
  const e = activeEffects.find((e) => e.kind === "wildfire");
  return e?.kind === "wildfire" && e.turnsRemaining > 0 ? e.multiplier : 1;
}

export function isBlitzClaimed(
  activeEffects: ActiveEffect[],
  playerId: PlayerId
): boolean {
  return activeEffects.some(
    (e) => e.kind === "blitzClaimed" && e.byPlayerId === playerId
  );
}

export function consumeBlitz(
  activeEffects: ActiveEffect[],
  playerId: PlayerId
): ActiveEffect[] {
  return activeEffects.filter(
    (e) => !(e.kind === "blitzClaimed" && e.byPlayerId === playerId)
  );
}

export function consumeSwapPending(
  activeEffects: ActiveEffect[],
  playerId: PlayerId
): { activeEffects: ActiveEffect[]; wasPending: boolean } {
  const idx = activeEffects.findIndex(
    (e) => e.kind === "swapPending" && e.byPlayerId === playerId
  );
  if (idx < 0) return { activeEffects, wasPending: false };
  const next = [...activeEffects];
  next.splice(idx, 1);
  return { activeEffects: next, wasPending: true };
}

export function getFreezeExpiresAt(
  activeEffects: ActiveEffect[],
  playerId: PlayerId
): number | undefined {
  const e = activeEffects.find(
    (e) => e.kind === "freeze" && e.onPlayerId === playerId
  );
  return e?.kind === "freeze" ? e.expiresAt : undefined;
}

export function tickEffects(activeEffects: ActiveEffect[], now: number): ActiveEffect[] {
  return activeEffects.filter((e) => {
    if (e.kind === "freeze") return e.expiresAt > now;
    return true;
  });
}
