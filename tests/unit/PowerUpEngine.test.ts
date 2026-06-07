import { describe, it, expect } from "vitest";
import {
  activate,
  addToInventory,
  consumeSecondLifeOnTimeout,
  consumeLetterBomb,
  emptyInventory,
  emptyTriggers,
  evaluateDrops,
  getLetterBombRequirement,
  REGISTRY,
} from "../../src/modules/PowerUpEngine";
import { TRIGGER_CATEGORY, SCORE_THRESHOLD_POINTS } from "../../src/modules/powerups/pools";
import type { DropTriggers } from "../../src/modules/powerups/types";

const P1 = "p1";
const P2 = "p2";

function withTriggers(): DropTriggers {
  return emptyTriggers(P1, P2);
}

// Deterministic rng — always returns 0, so pickFromCategory picks the first entry of the pool.
const rng0 = () => 0;

describe("PowerUpEngine.evaluateDrops — score thresholds", () => {
  it("emits one defensive drop when the player crosses a single threshold", () => {
    const { drops, triggers } = evaluateDrops({
      playerId: P1,
      prevRoundScore: 10,
      newRoundScore: 20, // crosses 15 once
      breakdown: { base: 10, rareLetter: 0, longWord: 0 },
      triggers: withTriggers(),
      rng: rng0,
    });

    expect(drops).toHaveLength(1);
    expect(drops[0]?.source).toBe("score_threshold");
    expect(triggers.thresholdsCrossed[P1]).toBe(1);
  });

  it("emits multiple drops when a single word crosses several thresholds", () => {
    const { drops, triggers } = evaluateDrops({
      playerId: P1,
      prevRoundScore: 14,
      newRoundScore: 60, // crosses 15, 30, 45, 60 → 4 thresholds (floor 0→4)
      breakdown: { base: 46, rareLetter: 0, longWord: 0 },
      triggers: withTriggers(),
      rng: rng0,
    });

    expect(drops).toHaveLength(4);
    expect(drops.every((d) => d.source === "score_threshold")).toBe(true);
    expect(triggers.thresholdsCrossed[P1]).toBe(4);
  });

  it("draws score-threshold drops from the defensive category", () => {
    const { drops } = evaluateDrops({
      playerId: P1,
      prevRoundScore: 0,
      newRoundScore: SCORE_THRESHOLD_POINTS,
      breakdown: { base: SCORE_THRESHOLD_POINTS, rareLetter: 0, longWord: 0 },
      triggers: withTriggers(),
      rng: rng0,
    });
    expect(drops).toHaveLength(1);
    const def = REGISTRY.find((d) => d.id === drops[0]?.id);
    expect(def?.category).toBe(TRIGGER_CATEGORY.score_threshold);
  });
});

describe("PowerUpEngine.evaluateDrops — special-word bonuses", () => {
  it("grants a rare-letter bonus drop the first time a rare letter is played in a round", () => {
    const { drops, triggers } = evaluateDrops({
      playerId: P1,
      prevRoundScore: 0,
      newRoundScore: 5,
      breakdown: { base: 4, rareLetter: 1, longWord: 0 },
      triggers: withTriggers(),
      rng: rng0,
    });
    const rareDrops = drops.filter((d) => d.source === "rare_letter");
    expect(rareDrops).toHaveLength(1);
    expect(triggers.rareLetterDropped[P1]).toBe(true);
  });

  it("does not grant a second rare-letter bonus drop in the same round", () => {
    const round1 = evaluateDrops({
      playerId: P1,
      prevRoundScore: 0,
      newRoundScore: 5,
      breakdown: { base: 4, rareLetter: 1, longWord: 0 },
      triggers: withTriggers(),
      rng: rng0,
    });

    const round2 = evaluateDrops({
      playerId: P1,
      prevRoundScore: 5,
      newRoundScore: 11,
      breakdown: { base: 5, rareLetter: 1, longWord: 0 },
      triggers: round1.triggers,
      rng: rng0,
    });

    expect(round2.drops.filter((d) => d.source === "rare_letter")).toHaveLength(0);
  });

  it("grants a long-word bonus drop the first time an 8+ letter word is played", () => {
    const { drops, triggers } = evaluateDrops({
      playerId: P1,
      prevRoundScore: 0,
      newRoundScore: 13,
      breakdown: { base: 8, rareLetter: 0, longWord: 5 },
      triggers: withTriggers(),
      rng: rng0,
    });
    const longDrops = drops.filter((d) => d.source === "long_word");
    expect(longDrops).toHaveLength(1);
    expect(triggers.longWordDropped[P1]).toBe(true);
  });

  it("tracks the rare-letter trigger separately per player", () => {
    let triggers = withTriggers();
    const p1Result = evaluateDrops({
      playerId: P1,
      prevRoundScore: 0,
      newRoundScore: 4,
      breakdown: { base: 3, rareLetter: 1, longWord: 0 },
      triggers,
      rng: rng0,
    });
    triggers = p1Result.triggers;
    const p2Result = evaluateDrops({
      playerId: P2,
      prevRoundScore: 0,
      newRoundScore: 4,
      breakdown: { base: 3, rareLetter: 1, longWord: 0 },
      triggers,
      rng: rng0,
    });
    expect(p2Result.drops.filter((d) => d.source === "rare_letter")).toHaveLength(1);
  });
});

describe("PowerUpEngine.activate — Freeze", () => {
  it("decrements inventory and sets a freeze effect on the opponent", () => {
    const inventory = addToInventory(emptyInventory(), "freeze");
    const result = activate({
      inventory,
      activeEffects: [],
      powerUpId: "freeze",
      byPlayerId: P1,
      opponentId: P2,
      now: 1_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.inventory.freeze).toBe(0);
    expect(result.activeEffects).toHaveLength(1);
    const e = result.activeEffects[0];
    expect(e?.kind).toBe("freeze");
    if (e?.kind === "freeze") {
      expect(e.onPlayerId).toBe(P2);
      expect(e.expiresAt).toBeGreaterThan(1_000);
    }
  });

  it("rejects activation when not in inventory", () => {
    const result = activate({
      inventory: emptyInventory(),
      activeEffects: [],
      powerUpId: "freeze",
      byPlayerId: P1,
      opponentId: P2,
      now: 0,
    });
    expect(result.error).toBe("not_in_inventory");
  });
});

describe("PowerUpEngine — Second Life", () => {
  it("arms an effect on activation that consumes on timeout instead of losing the round", () => {
    const inventory = addToInventory(emptyInventory(), "secondLife");
    const a = activate({
      inventory,
      activeEffects: [],
      powerUpId: "secondLife",
      byPlayerId: P1,
      opponentId: P2,
      now: 0,
    });
    expect(a.error).toBeUndefined();

    const consume = consumeSecondLifeOnTimeout(a.activeEffects, P1);
    expect(consume.consumed).toBe(true);
    expect(consume.activeEffects).toHaveLength(0);

    // A second timeout should not be saved by an already-spent Second Life.
    const reconsume = consumeSecondLifeOnTimeout(consume.activeEffects, P1);
    expect(reconsume.consumed).toBe(false);
  });
});

describe("PowerUpEngine — Letter Bomb", () => {
  it("sets a required letter on the opponent and is queryable", () => {
    const inventory = addToInventory(emptyInventory(), "letterBomb");
    const a = activate({
      inventory,
      activeEffects: [],
      powerUpId: "letterBomb",
      byPlayerId: P1,
      opponentId: P2,
      now: 0,
      rng: () => 0, // picks "Q"
    });
    expect(a.error).toBeUndefined();
    const required = getLetterBombRequirement(a.activeEffects, P2);
    expect(required).toBe("Q");
  });

  it("consumes the bomb constraint after one turn", () => {
    const inventory = addToInventory(emptyInventory(), "letterBomb");
    const a = activate({
      inventory,
      activeEffects: [],
      powerUpId: "letterBomb",
      byPlayerId: P1,
      opponentId: P2,
      now: 0,
      rng: () => 0,
    });
    const after = consumeLetterBomb(a.activeEffects, P2);
    expect(after.consumedRequiredLetter).toBe("Q");
    expect(getLetterBombRequirement(after.activeEffects, P2)).toBeUndefined();
  });
});

describe("PowerUpEngine — Block", () => {
  it("decrements inventory but does not set an active effect", () => {
    const inventory = addToInventory(emptyInventory(), "block");
    const result = activate({
      inventory,
      activeEffects: [],
      powerUpId: "block",
      byPlayerId: P1,
      opponentId: P2,
      now: 0,
    });
    expect(result.error).toBeUndefined();
    expect(result.inventory.block).toBe(0);
    expect(result.activeEffects).toHaveLength(0);
    expect(result.effect).toBeUndefined();
  });
});
