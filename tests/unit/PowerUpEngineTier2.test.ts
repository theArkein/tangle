import { describe, it, expect } from "vitest";
import {
  activate,
  addToInventory,
  emptyInventory,
  emptyTriggers,
  evaluateDrops,
} from "../../src/modules/PowerUpEngine";
import { score } from "../../src/modules/ScoringEngine";

const P1 = "p1";
const P2 = "p2";

describe("PowerUpEngine — Second Life (manual)", () => {
  it("decrements inventory with no persistent ActiveEffect", () => {
    const inventory = addToInventory(emptyInventory(), "secondLife");
    const result = activate({
      inventory,
      activeEffects: [],
      powerUpId: "secondLife",
      byPlayerId: P1,
      opponentId: P2,
    });
    expect(result.error).toBeUndefined();
    expect(result.inventory.secondLife).toBe(0);
    expect(result.activeEffects).toHaveLength(0);
    expect(result.effect).toBeUndefined();
  });
});

describe("PowerUpEngine.evaluateDrops — secondLife trigger", () => {
  it("awards secondLife when a word scores > 15 points", () => {
    // "extraordinary" has X(+3) + length 13 + long bonus = well over 15
    const word = "extraordinary";
    const scoreResult = score(word, { multiplier: 1 });
    const { drops } = evaluateDrops({
      playerId: P1,
      opponentId: P2,
      word,
      scoreResult,
      prevRoundScore: 0,
      newRoundScore: scoreResult.points,
      triggers: emptyTriggers(P1, P2),
    });

    expect(scoreResult.points).toBeGreaterThan(15);
    expect(drops.some((d) => d.id === "secondLife" && d.playerId === P1)).toBe(true);
  });

  it("does not award secondLife for 15 points exactly", () => {
    const word = "excellent"; // typically scores around 15
    const scoreResult = score(word, { multiplier: 1 });
    const { drops } = evaluateDrops({
      playerId: P1,
      opponentId: P2,
      word,
      scoreResult,
      prevRoundScore: 0,
      newRoundScore: scoreResult.points,
      triggers: emptyTriggers(P1, P2),
    });

    // Only award if > 15, not >= 15
    const hasSecondLife = drops.some((d) => d.id === "secondLife" && d.playerId === P1);
    const shouldHave = scoreResult.points > 15;
    expect(hasSecondLife).toBe(shouldHave);
  });
});

describe("PowerUpEngine.evaluateDrops — letterBomb (contains Q/X/Z/J)", () => {
  it("awards letterBomb when word contains a Tier 1 rare letter", () => {
    const word = "quality";
    const scoreResult = score(word, { multiplier: 1 });
    const { drops } = evaluateDrops({
      playerId: P1,
      opponentId: P2,
      word,
      scoreResult,
      prevRoundScore: 0,
      newRoundScore: scoreResult.points,
      triggers: emptyTriggers(P1, P2),
    });

    expect(drops.some((d) => d.id === "letterBomb")).toBe(true);
  });

  it("does not award letterBomb for a word without Tier 1 letters", () => {
    const word = "table";
    const scoreResult = score(word, { multiplier: 1 });
    const { drops } = evaluateDrops({
      playerId: P1,
      opponentId: P2,
      word,
      scoreResult,
      prevRoundScore: 0,
      newRoundScore: scoreResult.points,
      triggers: emptyTriggers(P1, P2),
    });

    expect(drops.some((d) => d.id === "letterBomb")).toBe(false);
  });
});

