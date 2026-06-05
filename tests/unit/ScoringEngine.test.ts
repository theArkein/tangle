import { describe, it, expect } from "vitest";
import { score } from "../../src/modules/ScoringEngine";

describe("ScoringEngine", () => {
  it('scores "cat" correctly', () => {
    expect(score("cat")).toEqual({
      points: 3,
      breakdown: { base: 3, rareLetter: 0, longWord: 0 },
    });
  });

  it('scores "elephant" (8 letters) correctly', () => {
    expect(score("elephant")).toEqual({
      points: 13,
      breakdown: { base: 8, rareLetter: 0, longWord: 5 },
    });
  });

  it('scores "ax" correctly (X is rare)', () => {
    expect(score("ax")).toEqual({
      points: 3,
      breakdown: { base: 2, rareLetter: 1, longWord: 0 },
    });
  });

  it('scores "jazz" correctly (J and Z are rare)', () => {
    expect(score("jazz")).toEqual({
      points: 6,
      breakdown: { base: 4, rareLetter: 2, longWord: 0 },
    });
  });

  it('scores "xylophone" (9 letters, X is rare) correctly', () => {
    expect(score("xylophone")).toEqual({
      points: 15,
      breakdown: { base: 9, rareLetter: 1, longWord: 5 },
    });
  });

  it('scores "a" correctly', () => {
    expect(score("a")).toEqual({
      points: 1,
      breakdown: { base: 1, rareLetter: 0, longWord: 0 },
    });
  });
});
