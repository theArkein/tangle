import { describe, it, expect } from "vitest";
import {
  activate,
  addToInventory,
  consumeShrink,
  consumeRush,
  consumeBlitz,
  consumeSwapPending,
  decrementBlind,
  decrementPeek,
  decrementWildfire,
  emptyInventory,
  emptyTriggers,
  evaluateDrops,
  getShrinkMaxLength,
  getWildfireMultiplier,
  isBlinded,
  isPeekActive,
  isBlitzClaimed,
} from "../../src/modules/PowerUpEngine";

const P1 = "p1";
const P2 = "p2";

describe("PowerUpEngine — Swap", () => {
  it("arms a pending swap for the activator on activation", () => {
    const inv = addToInventory(emptyInventory(), "swap");
    const r = activate({
      inventory: inv,
      activeEffects: [],
      powerUpId: "swap",
      byPlayerId: P1,
      opponentId: P2,
      now: 0,
    });
    expect(r.error).toBeUndefined();
    expect(r.inventory.swap).toBe(0);
    expect(r.activeEffects).toEqual([{ kind: "swapPending", byPlayerId: P1 }]);
  });

  it("consumeSwapPending clears the effect", () => {
    const after = consumeSwapPending(
      [{ kind: "swapPending", byPlayerId: P1 }],
      P1
    );
    expect(after.wasPending).toBe(true);
    expect(after.activeEffects).toEqual([]);
  });
});

describe("PowerUpEngine — Blind", () => {
  it("sets a 2-turn blind on the opponent", () => {
    const inv = addToInventory(emptyInventory(), "blind");
    const r = activate({
      inventory: inv,
      activeEffects: [],
      powerUpId: "blind",
      byPlayerId: P1,
      opponentId: P2,
      now: 0,
    });
    expect(isBlinded(r.activeEffects, P2)).toBe(true);
    expect(isBlinded(r.activeEffects, P1)).toBe(false);
  });

  it("decrements and expires after 2 turns", () => {
    const inv = addToInventory(emptyInventory(), "blind");
    const r = activate({
      inventory: inv,
      activeEffects: [],
      powerUpId: "blind",
      byPlayerId: P1,
      opponentId: P2,
      now: 0,
    });
    let effects = r.activeEffects;
    effects = decrementBlind(effects);
    expect(isBlinded(effects, P2)).toBe(true);
    effects = decrementBlind(effects);
    expect(isBlinded(effects, P2)).toBe(false);
  });
});

describe("PowerUpEngine — Shrink", () => {
  it("sets a maxLength=4 constraint on the opponent", () => {
    const inv = addToInventory(emptyInventory(), "shrink");
    const r = activate({
      inventory: inv,
      activeEffects: [],
      powerUpId: "shrink",
      byPlayerId: P1,
      opponentId: P2,
      now: 0,
    });
    expect(getShrinkMaxLength(r.activeEffects, P2)).toBe(4);
  });

  it("is cleared by consumeShrink after one turn", () => {
    const inv = addToInventory(emptyInventory(), "shrink");
    const r = activate({
      inventory: inv,
      activeEffects: [],
      powerUpId: "shrink",
      byPlayerId: P1,
      opponentId: P2,
      now: 0,
    });
    const after = consumeShrink(r.activeEffects, P2);
    expect(after.consumedMaxLength).toBe(4);
    expect(getShrinkMaxLength(after.activeEffects, P2)).toBeUndefined();
  });
});

describe("PowerUpEngine — Rush", () => {
  it("sets a rush effect on the opponent, consumable once", () => {
    const inv = addToInventory(emptyInventory(), "rush");
    const r = activate({
      inventory: inv,
      activeEffects: [],
      powerUpId: "rush",
      byPlayerId: P1,
      opponentId: P2,
      now: 0,
    });
    const after = consumeRush(r.activeEffects, P2);
    expect(after.consumed).toBe(true);
    const again = consumeRush(after.activeEffects, P2);
    expect(again.consumed).toBe(false);
  });
});

describe("PowerUpEngine — Steal (engine side)", () => {
  it("decrements inventory and leaves chain mutation to caller", () => {
    const inv = addToInventory(emptyInventory(), "steal");
    const r = activate({
      inventory: inv,
      activeEffects: [],
      powerUpId: "steal",
      byPlayerId: P1,
      opponentId: P2,
      now: 0,
    });
    expect(r.inventory.steal).toBe(0);
    expect(r.effect).toBeUndefined();
  });
});

describe("PowerUpEngine — Peek", () => {
  it("arms a one-turn peek for the activator", () => {
    const inv = addToInventory(emptyInventory(), "peek");
    const r = activate({
      inventory: inv,
      activeEffects: [],
      powerUpId: "peek",
      byPlayerId: P1,
      opponentId: P2,
      now: 0,
    });
    expect(isPeekActive(r.activeEffects, P1)).toBe(true);
  });

  it("expires after one decrement", () => {
    const effects = decrementPeek([
      { kind: "peek", forPlayerId: P1, turnsRemaining: 1 },
    ]);
    expect(isPeekActive(effects, P1)).toBe(false);
  });
});

describe("PowerUpEngine — Blitz", () => {
  it("registers a blitzClaimed effect for the activator", () => {
    const inv = addToInventory(emptyInventory(), "blitz");
    const r = activate({
      inventory: inv,
      activeEffects: [],
      powerUpId: "blitz",
      byPlayerId: P1,
      opponentId: P2,
      now: 0,
    });
    expect(isBlitzClaimed(r.activeEffects, P1)).toBe(true);
  });

  it("is cleared by consumeBlitz", () => {
    const after = consumeBlitz(
      [{ kind: "blitzClaimed", byPlayerId: P1 }],
      P1
    );
    expect(isBlitzClaimed(after, P1)).toBe(false);
  });
});

describe("PowerUpEngine — Wildfire", () => {
  it("applies a 3× multiplier for 3 turns", () => {
    const inv = addToInventory(emptyInventory(), "wildfire");
    const r = activate({
      inventory: inv,
      activeEffects: [],
      powerUpId: "wildfire",
      byPlayerId: P1,
      opponentId: P2,
      now: 0,
    });
    expect(getWildfireMultiplier(r.activeEffects)).toBe(3);
    let effects = r.activeEffects;
    effects = decrementWildfire(effects);
    expect(getWildfireMultiplier(effects)).toBe(3);
    effects = decrementWildfire(effects);
    effects = decrementWildfire(effects);
    expect(getWildfireMultiplier(effects)).toBe(1);
  });
});

describe("PowerUpEngine.evaluateDrops — chain length trigger", () => {
  it("emits a disruption drop when chain hits 10 for the first time", () => {
    const triggers = emptyTriggers(P1, P2);
    const { drops, triggers: next } = evaluateDrops({
      playerId: P1,
      prevRoundScore: 0,
      newRoundScore: 3,
      breakdown: { base: 3, rareLetter: 0, longWord: 0 },
      triggers,
      chainLength: 10,
      rng: () => 0,
    });
    const chainDrops = drops.filter((d) => d.source === "chain_length");
    expect(chainDrops).toHaveLength(1);
    expect(next.chainLengthDropped[P1]).toBe(true);
  });

  it("does not re-emit a chain-length drop in the same round", () => {
    let triggers = emptyTriggers(P1, P2);
    triggers = evaluateDrops({
      playerId: P1,
      prevRoundScore: 0,
      newRoundScore: 3,
      breakdown: { base: 3, rareLetter: 0, longWord: 0 },
      triggers,
      chainLength: 10,
      rng: () => 0,
    }).triggers;
    const next = evaluateDrops({
      playerId: P1,
      prevRoundScore: 3,
      newRoundScore: 6,
      breakdown: { base: 3, rareLetter: 0, longWord: 0 },
      triggers,
      chainLength: 11,
      rng: () => 0,
    });
    expect(next.drops.filter((d) => d.source === "chain_length")).toHaveLength(0);
  });
});
