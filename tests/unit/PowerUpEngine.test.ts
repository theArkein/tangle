import { describe, it, expect } from "vitest";
import {
  activate,
  addToInventory,
  consumeLetterBomb,
  emptyInventory,
  emptyTriggers,
  evaluateDrops,
  hasLetterBombEffect,
  isWildPending,
  consumeWild,
  getDoubleScore,
  decrementDouble,
  getAnchor,
  consumeAnchor,
} from "../../src/modules/PowerUpEngine";
import { score } from "../../src/modules/ScoringEngine";
import type { DropTriggers } from "../../src/modules/powerups/types";

const P1 = "p1";
const P2 = "p2";

function withTriggers(): DropTriggers {
  return emptyTriggers(P1, P2);
}

function mkScoreResult(word: string, multiplier = 1) {
  return score(word, { multiplier });
}

describe("PowerUpEngine.evaluateDrops — extend (25pt threshold)", () => {
  it("emits a extend drop when the player crosses a 25-point threshold", () => {
    const { drops, triggers } = evaluateDrops({
      playerId: P1,
      opponentId: P2,
      word: "apple",
      scoreResult: mkScoreResult("apple"),
      prevRoundScore: 10,
      newRoundScore: 26,
      triggers: withTriggers(),
    });

    const freezeDrops = drops.filter((d) => d.id === "extend");
    expect(freezeDrops).toHaveLength(1);
    expect(triggers.playerFreezeThresholds[P1]).toBe(1);
  });

  it("emits two extend drops when crossing two 25-point thresholds at once", () => {
    const { drops } = evaluateDrops({
      playerId: P1,
      opponentId: P2,
      word: "apple",
      scoreResult: mkScoreResult("apple"),
      prevRoundScore: 0,
      newRoundScore: 51,
      triggers: withTriggers(),
    });

    expect(drops.filter((d) => d.id === "extend")).toHaveLength(2);
  });
});

describe("PowerUpEngine.evaluateDrops — double (10+ letters)", () => {
  it("emits a double drop for a 10-letter word", () => {
    const word = "abcdefghij";
    const { drops } = evaluateDrops({
      playerId: P1,
      opponentId: P2,
      word,
      scoreResult: mkScoreResult(word),
      prevRoundScore: 0,
      newRoundScore: 10,
      triggers: withTriggers(),
    });

    expect(drops.some((d) => d.id === "double")).toBe(true);
  });

  it("does not emit double for a 9-letter word", () => {
    const word = "abcdefghi";
    const { drops } = evaluateDrops({
      playerId: P1,
      opponentId: P2,
      word,
      scoreResult: mkScoreResult(word),
      prevRoundScore: 0,
      newRoundScore: 9,
      triggers: withTriggers(),
    });

    expect(drops.some((d) => d.id === "double")).toBe(false);
  });
});

describe("PowerUpEngine.evaluateDrops — anchor (8+ letters)", () => {
  it("emits an anchor drop for an 8-letter word", () => {
    const word = "elephant";
    const { drops } = evaluateDrops({
      playerId: P1,
      opponentId: P2,
      word,
      scoreResult: mkScoreResult(word),
      prevRoundScore: 0,
      newRoundScore: 8,
      triggers: withTriggers(),
    });

    expect(drops.some((d) => d.id === "anchor")).toBe(true);
  });
});

describe("PowerUpEngine.evaluateDrops — wild (same start/end letter)", () => {
  it("emits a wild drop for palindromic words", () => {
    const { drops } = evaluateDrops({
      playerId: P1,
      opponentId: P2,
      word: "eagle",
      scoreResult: mkScoreResult("eagle"),
      prevRoundScore: 0,
      newRoundScore: 5,
      triggers: withTriggers(),
    });

    expect(drops.some((d) => d.id === "wild")).toBe(true);
  });

  it("does not emit wild for non-palindromic words", () => {
    const { drops } = evaluateDrops({
      playerId: P1,
      opponentId: P2,
      word: "apple",
      scoreResult: mkScoreResult("apple"),
      prevRoundScore: 0,
      newRoundScore: 5,
      triggers: withTriggers(),
    });

    expect(drops.some((d) => d.id === "wild")).toBe(false);
  });
});

describe("PowerUpEngine.evaluateDrops — DZ entry secondLife", () => {
  it("awards secondLife to both players when entering Danger Zone", () => {
    const { drops } = evaluateDrops({
      playerId: P1,
      opponentId: P2,
      word: "apple",
      scoreResult: mkScoreResult("apple"),
      prevRoundScore: 0,
      newRoundScore: 5,
      triggers: withTriggers(),
      isDangerZone: true,
      justEnteredDangerZone: true,
    });

    const slDrops = drops.filter((d) => d.id === "secondLife");
    const playerIds = slDrops.map((d) => d.playerId).sort();
    expect(playerIds).toContain(P1);
    expect(playerIds).toContain(P2);
  });
});

describe("PowerUpEngine.activate — Freeze", () => {
  it("decrements inventory and returns alarmDeltaMs of 5000", () => {
    const inventory = addToInventory(emptyInventory(), "extend");
    const result = activate({
      inventory,
      activeEffects: [],
      powerUpId: "extend",
      byPlayerId: P1,
      opponentId: P2,
    });
    expect(result.error).toBeUndefined();
    expect(result.inventory.extend).toBe(0);
    expect(result.alarmDeltaMs).toBe(5_000);
    expect(result.activeEffects).toHaveLength(0);
  });

  it("rejects activation when not in inventory", () => {
    const result = activate({
      inventory: emptyInventory(),
      activeEffects: [],
      powerUpId: "extend",
      byPlayerId: P1,
      opponentId: P2,
    });
    expect(result.error).toBe("not_in_inventory");
  });
});

describe("PowerUpEngine — Double", () => {
  it("creates a doubleScore effect with 2 words remaining", () => {
    const inventory = addToInventory(emptyInventory(), "double");
    const result = activate({
      inventory,
      activeEffects: [],
      powerUpId: "double",
      byPlayerId: P1,
      opponentId: P2,
    });
    expect(result.error).toBeUndefined();
    const ds = getDoubleScore(result.activeEffects, P1);
    expect(ds?.wordsRemaining).toBe(2);
  });

  it("decrements wordsRemaining and removes effect at 0", () => {
    let effects = activate({
      inventory: addToInventory(emptyInventory(), "double"),
      activeEffects: [],
      powerUpId: "double",
      byPlayerId: P1,
      opponentId: P2,
    }).activeEffects;

    effects = decrementDouble(effects, P1);
    expect(getDoubleScore(effects, P1)?.wordsRemaining).toBe(1);
    effects = decrementDouble(effects, P1);
    expect(getDoubleScore(effects, P1)).toBeUndefined();
  });
});

describe("PowerUpEngine — Wild", () => {
  it("creates a wildPending effect for the activator", () => {
    const inventory = addToInventory(emptyInventory(), "wild");
    const result = activate({
      inventory,
      activeEffects: [],
      powerUpId: "wild",
      byPlayerId: P1,
      opponentId: P2,
    });
    expect(isWildPending(result.activeEffects, P1)).toBe(true);
    expect(isWildPending(result.activeEffects, P2)).toBe(false);
  });

  it("consumeWild clears the effect", () => {
    const effects = [{ kind: "wildPending" as const, forPlayerId: P1 }];
    const after = consumeWild(effects, P1);
    expect(isWildPending(after, P1)).toBe(false);
  });
});

describe("PowerUpEngine — Anchor", () => {
  it("sets a minLength=6 constraint on the opponent", () => {
    const inventory = addToInventory(emptyInventory(), "anchor");
    const result = activate({
      inventory,
      activeEffects: [],
      powerUpId: "anchor",
      byPlayerId: P1,
      opponentId: P2,
    });
    const anchor = getAnchor(result.activeEffects, P2);
    expect(anchor?.minLength).toBe(6);
  });

  it("consumeAnchor clears the effect", () => {
    const effects = [{ kind: "anchor" as const, onPlayerId: P2, minLength: 6 }];
    const after = consumeAnchor(effects, P2);
    expect(getAnchor(after, P2)).toBeUndefined();
  });
});

describe("PowerUpEngine — one opponent-targeting effect at a time", () => {
  it("rejects Anchor when a Letter Bomb is already on the opponent", () => {
    const first = activate({
      inventory: addToInventory(addToInventory(emptyInventory(), "letterBomb"), "anchor"),
      activeEffects: [],
      powerUpId: "letterBomb",
      byPlayerId: P1,
      opponentId: P2,
    });
    expect(first.error).toBeUndefined();

    const second = activate({
      inventory: first.inventory,
      activeEffects: first.activeEffects,
      powerUpId: "anchor",
      byPlayerId: P1,
      opponentId: P2,
    });
    expect(second.error).toBe("opponent_effect_active");
    // Inventory and effects must be left untouched on rejection.
    expect(second.inventory.anchor).toBe(1);
    expect(second.activeEffects).toEqual(first.activeEffects);
  });

  it("rejects a second Letter Bomb while one is already active", () => {
    const first = activate({
      inventory: { ...emptyInventory(), letterBomb: 2 },
      activeEffects: [],
      powerUpId: "letterBomb",
      byPlayerId: P1,
      opponentId: P2,
    });
    const second = activate({
      inventory: first.inventory,
      activeEffects: first.activeEffects,
      powerUpId: "letterBomb",
      byPlayerId: P1,
      opponentId: P2,
    });
    expect(second.error).toBe("opponent_effect_active");
  });

  it("allows a self-targeting power-up while an opponent effect is active", () => {
    const first = activate({
      inventory: { ...emptyInventory(), letterBomb: 1, double: 1 },
      activeEffects: [],
      powerUpId: "letterBomb",
      byPlayerId: P1,
      opponentId: P2,
    });
    const second = activate({
      inventory: first.inventory,
      activeEffects: first.activeEffects,
      powerUpId: "double",
      byPlayerId: P1,
      opponentId: P2,
    });
    expect(second.error).toBeUndefined();
  });
});

describe("PowerUpEngine — Double cannot stack", () => {
  it("rejects a second Double while one is already active", () => {
    const first = activate({
      inventory: { ...emptyInventory(), double: 2 },
      activeEffects: [],
      powerUpId: "double",
      byPlayerId: P1,
      opponentId: P2,
    });
    expect(first.error).toBeUndefined();

    const second = activate({
      inventory: first.inventory,
      activeEffects: first.activeEffects,
      powerUpId: "double",
      byPlayerId: P1,
      opponentId: P2,
    });
    expect(second.error).toBe("double_active");
    expect(second.inventory.double).toBe(1);
    expect(second.activeEffects).toEqual(first.activeEffects);
  });

  it("allows a new Double once the previous one has expired", () => {
    const first = activate({
      inventory: { ...emptyInventory(), double: 2 },
      activeEffects: [],
      powerUpId: "double",
      byPlayerId: P1,
      opponentId: P2,
    });
    // Consume both words of the first Double so the effect drops off.
    let effects = decrementDouble(first.activeEffects, P1);
    effects = decrementDouble(effects, P1);
    expect(getDoubleScore(effects, P1)).toBeUndefined();

    const again = activate({
      inventory: first.inventory,
      activeEffects: effects,
      powerUpId: "double",
      byPlayerId: P1,
      opponentId: P2,
    });
    expect(again.error).toBeUndefined();
  });
});

describe("PowerUpEngine — Letter Bomb", () => {
  it("sets a rare-letter bomb on the opponent and is queryable", () => {
    const inventory = addToInventory(emptyInventory(), "letterBomb");
    const a = activate({
      inventory,
      activeEffects: [],
      powerUpId: "letterBomb",
      byPlayerId: P1,
      opponentId: P2,
    });
    expect(a.error).toBeUndefined();
    expect(hasLetterBombEffect(a.activeEffects, P2)).toBe(true);
    expect(hasLetterBombEffect(a.activeEffects, P1)).toBe(false);
  });

  it("consumes the bomb after one turn", () => {
    const inventory = addToInventory(emptyInventory(), "letterBomb");
    const a = activate({
      inventory,
      activeEffects: [],
      powerUpId: "letterBomb",
      byPlayerId: P1,
      opponentId: P2,
    });
    const { activeEffects: after } = consumeLetterBomb(a.activeEffects, P2);
    expect(hasLetterBombEffect(after, P2)).toBe(false);
  });
});
