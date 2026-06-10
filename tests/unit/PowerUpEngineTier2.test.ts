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

describe("PowerUpEngine.evaluateDrops — secondLife paths", () => {
  it("awards secondLife when a word scores 15+ points", () => {
    // "qualification" has Q(+3) + length 13 = 16pts base, well over 15
    const word = "qualification";
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

    expect(drops.some((d) => d.id === "secondLife" && d.playerId === P1)).toBe(true);
  });

  it("awards secondLife when word contains 4+ distinct vowels", () => {
    // "education" has e, u, a, i, o = 5 distinct vowels
    const word = "education";
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

    expect(drops.some((d) => d.id === "secondLife" && d.playerId === P1)).toBe(true);
  });

  it("awards secondLife when word has letters from 2+ rare tiers", () => {
    // "quiver" has Q (tier1) and V (tier2)
    const word = "quiver";
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

    expect(drops.some((d) => d.id === "secondLife" && d.playerId === P1)).toBe(true);
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

describe("PowerUpEngine.evaluateDrops — word count tracking", () => {
  it("increments playerWordCount after each drop evaluation", () => {
    const t = emptyTriggers(P1, P2);
    const word = "abc";
    const { triggers } = evaluateDrops({
      playerId: P1,
      opponentId: P2,
      word,
      scoreResult: score(word, { multiplier: 1 }),
      prevRoundScore: 0,
      newRoundScore: 3,
      triggers: t,
    });

    expect(triggers.playerWordCounts[P1]).toBe(1);
    expect(triggers.playerWordCounts[P2]).toBe(0);
  });
});
