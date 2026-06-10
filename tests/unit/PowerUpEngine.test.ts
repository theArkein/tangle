import { describe, it, expect } from "vitest";
import {
  activate,
  addToInventory,
  consumeLetterBomb,
  emptyInventory,
  emptyTriggers,
  evaluateDrops,
  getLetterBombRequirement,
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

describe("PowerUpEngine.evaluateDrops — freeze (25pt threshold)", () => {
  it("emits a freeze drop when the player crosses a 25-point threshold", () => {
    const { drops, triggers } = evaluateDrops({
      playerId: P1,
      opponentId: P2,
      word: "apple",
      scoreResult: mkScoreResult("apple"),
      prevRoundScore: 10,
      newRoundScore: 26,
      triggers: withTriggers(),
    });

    const freezeDrops = drops.filter((d) => d.id === "freeze");
    expect(freezeDrops).toHaveLength(1);
    expect(triggers.playerFreezeThresholds[P1]).toBe(1);
  });

  it("emits two freeze drops when crossing two 25-point thresholds at once", () => {
    const { drops } = evaluateDrops({
      playerId: P1,
      opponentId: P2,
      word: "apple",
      scoreResult: mkScoreResult("apple"),
      prevRoundScore: 0,
      newRoundScore: 51,
      triggers: withTriggers(),
    });

    expect(drops.filter((d) => d.id === "freeze")).toHaveLength(2);
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

describe("PowerUpEngine.evaluateDrops — wild (every 6 words)", () => {
  it("emits a wild drop on the 6th word", () => {
    const t = { ...withTriggers(), playerWordCounts: { [P1]: 5, [P2]: 0 } };
    const { drops } = evaluateDrops({
      playerId: P1,
      opponentId: P2,
      word: "abc",
      scoreResult: mkScoreResult("abc"),
      prevRoundScore: 0,
      newRoundScore: 3,
      triggers: t,
    });

    expect(drops.some((d) => d.id === "wild")).toBe(true);
  });

  it("does not emit wild on the 5th word", () => {
    const t = { ...withTriggers(), playerWordCounts: { [P1]: 4, [P2]: 0 } };
    const { drops } = evaluateDrops({
      playerId: P1,
      opponentId: P2,
      word: "abc",
      scoreResult: mkScoreResult("abc"),
      prevRoundScore: 0,
      newRoundScore: 3,
      triggers: t,
    });

    expect(drops.some((d) => d.id === "wild")).toBe(false);
  });
});

describe("PowerUpEngine.evaluateDrops — tax (Danger Zone)", () => {
  it("emits a tax drop for any word played in the Danger Zone", () => {
    const { drops } = evaluateDrops({
      playerId: P1,
      opponentId: P2,
      word: "apple",
      scoreResult: mkScoreResult("apple"),
      prevRoundScore: 0,
      newRoundScore: 5,
      triggers: withTriggers(),
      isDangerZone: true,
    });

    expect(drops.some((d) => d.id === "tax")).toBe(true);
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
    const inventory = addToInventory(emptyInventory(), "freeze");
    const result = activate({
      inventory,
      activeEffects: [],
      powerUpId: "freeze",
      byPlayerId: P1,
      opponentId: P2,
    });
    expect(result.error).toBeUndefined();
    expect(result.inventory.freeze).toBe(0);
    expect(result.alarmDeltaMs).toBe(5_000);
    expect(result.activeEffects).toHaveLength(0);
  });

  it("rejects activation when not in inventory", () => {
    const result = activate({
      inventory: emptyInventory(),
      activeEffects: [],
      powerUpId: "freeze",
      byPlayerId: P1,
      opponentId: P2,
    });
    expect(result.error).toBe("not_in_inventory");
  });
});

describe("PowerUpEngine — Double", () => {
  it("creates a doubleScore effect with 3 words remaining", () => {
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
    expect(ds?.wordsRemaining).toBe(3);
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
    expect(getDoubleScore(effects, P1)?.wordsRemaining).toBe(2);
    effects = decrementDouble(effects, P1);
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

describe("PowerUpEngine — Tax", () => {
  it("decrements inventory and sets taxOpponent signal", () => {
    const inventory = addToInventory(emptyInventory(), "tax");
    const result = activate({
      inventory,
      activeEffects: [],
      powerUpId: "tax",
      byPlayerId: P1,
      opponentId: P2,
    });
    expect(result.error).toBeUndefined();
    expect(result.inventory.tax).toBe(0);
    expect(result.taxOpponent).toBe(true);
    expect(result.activeEffects).toHaveLength(0);
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
      rng: () => 0,
    });
    const after = consumeLetterBomb(a.activeEffects, P2);
    expect(after.consumedRequiredLetter).toBe("Q");
    expect(getLetterBombRequirement(after.activeEffects, P2)).toBeUndefined();
  });
});
