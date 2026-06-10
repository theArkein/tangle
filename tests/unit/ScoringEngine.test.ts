import { describe, it, expect } from "vitest";
import { score } from "../../src/modules/ScoringEngine";

describe("ScoringEngine", () => {
  it('scores "cat" correctly', () => {
    expect(score("cat")).toEqual({
      points: 3,
      breakdown: { base: 3, rareTier1: 0, rareTier2: 0, rareTier3: 0, longWord: 0 },
      multiplier: 1,
    });
  });

  it('scores "elephant" (8 letters) correctly', () => {
    // 8 base + 5 long-word bonus; H is Tier 3 (+1)
    expect(score("elephant")).toEqual({
      points: 14,
      breakdown: { base: 8, rareTier1: 0, rareTier2: 0, rareTier3: 1, longWord: 5 },
      multiplier: 1,
    });
  });

  it('scores "ax" correctly (X is Tier 1 rare)', () => {
    // 2 base + 3 (X Tier 1)
    expect(score("ax")).toEqual({
      points: 5,
      breakdown: { base: 2, rareTier1: 3, rareTier2: 0, rareTier3: 0, longWord: 0 },
      multiplier: 1,
    });
  });

  it('scores "jazz" correctly (J and Z are Tier 1 rare)', () => {
    // 4 base + J(+3) + Z(+3) + Z(+3) = 13
    expect(score("jazz")).toEqual({
      points: 13,
      breakdown: { base: 4, rareTier1: 9, rareTier2: 0, rareTier3: 0, longWord: 0 },
      multiplier: 1,
    });
  });

  it('scores "xylophone" (9 letters, X Tier 1, Y and H are Tier 3) correctly', () => {
    // 9 base + 5 long-word + X(+3) + Y(+1) + H(+1) = 19
    expect(score("xylophone")).toEqual({
      points: 19,
      breakdown: { base: 9, rareTier1: 3, rareTier2: 0, rareTier3: 2, longWord: 5 },
      multiplier: 1,
    });
  });

  it('scores "a" correctly', () => {
    expect(score("a")).toEqual({
      points: 1,
      breakdown: { base: 1, rareTier1: 0, rareTier2: 0, rareTier3: 0, longWord: 0 },
      multiplier: 1,
    });
  });

  it('applies a multiplier to the total', () => {
    expect(score("cat", { multiplier: 3 })).toEqual({
      points: 9,
      breakdown: { base: 3, rareTier1: 0, rareTier2: 0, rareTier3: 0, longWord: 0 },
      multiplier: 3,
    });
  });

  it('applies a multiplier to the long-word bonus too', () => {
    // elephant: 8 base + 5 long + 1 (H Tier3) = 14; × 2 = 28
    expect(score("elephant", { multiplier: 2 })).toEqual({
      points: 28,
      breakdown: { base: 8, rareTier1: 0, rareTier2: 0, rareTier3: 1, longWord: 5 },
      multiplier: 2,
    });
  });
});
