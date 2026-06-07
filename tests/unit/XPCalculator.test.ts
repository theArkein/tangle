import { describe, it, expect } from "vitest";
import { calculateXP } from "../../src/modules/XPCalculator";

describe("XPCalculator.calculateXP", () => {
  it("grants 100 XP base for a winner", () => {
    const r = calculateXP({ isWinner: true });
    expect(r.total).toBe(100);
    expect(r.breakdown.base).toBe(100);
    expect(r.breakdown.dangerZone).toBe(0);
  });

  it("grants 30 XP base for a loser", () => {
    const r = calculateXP({ isWinner: false });
    expect(r.total).toBe(30);
    expect(r.breakdown.base).toBe(30);
    expect(r.breakdown.dangerZone).toBe(0);
  });

  it("adds 50 XP danger zone bonus to a winner", () => {
    const r = calculateXP({ isWinner: true, reachedDangerZone: true });
    expect(r.total).toBe(150);
    expect(r.breakdown.base).toBe(100);
    expect(r.breakdown.dangerZone).toBe(50);
  });

  it("adds 50 XP danger zone bonus to a loser", () => {
    const r = calculateXP({ isWinner: false, reachedDangerZone: true });
    expect(r.total).toBe(80);
  });
});
