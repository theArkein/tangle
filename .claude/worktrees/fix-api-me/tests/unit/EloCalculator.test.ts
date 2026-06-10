import { describe, it, expect } from "vitest";
import { calculate } from "../../src/modules/EloCalculator";

describe("EloCalculator", () => {
  it("equal ELO (1000 vs 1000): winnerDelta === 16, loserDelta === -16", () => {
    const result = calculate(1000, 1000);
    expect(result.winnerDelta).toBe(16);
    expect(result.loserDelta).toBe(-16);
  });

  it("higher-ELO player wins (1200 vs 1000): smaller reward than 16", () => {
    const result = calculate(1200, 1000);
    expect(result.winnerDelta).toBeLessThan(16);
  });

  it("lower-ELO player wins (800 vs 1000): larger reward than 16 (upset)", () => {
    const result = calculate(800, 1000);
    expect(result.winnerDelta).toBeGreaterThan(16);
  });

  it("zero-sum: equal ELO", () => {
    const result = calculate(1000, 1000);
    expect(result.winnerDelta + result.loserDelta).toBe(0);
  });

  it("zero-sum: higher-ELO wins", () => {
    const result = calculate(1200, 1000);
    expect(result.winnerDelta + result.loserDelta).toBe(0);
  });

  it("zero-sum: lower-ELO wins (upset)", () => {
    const result = calculate(800, 1000);
    expect(result.winnerDelta + result.loserDelta).toBe(0);
  });

  it("winnerDelta > 0 for equal ELO", () => {
    expect(calculate(1000, 1000).winnerDelta).toBeGreaterThan(0);
  });

  it("winnerDelta > 0 for higher-ELO winner", () => {
    expect(calculate(1200, 1000).winnerDelta).toBeGreaterThan(0);
  });

  it("winnerDelta > 0 for lower-ELO winner (upset)", () => {
    expect(calculate(800, 1000).winnerDelta).toBeGreaterThan(0);
  });

  it("loserDelta < 0 for equal ELO", () => {
    expect(calculate(1000, 1000).loserDelta).toBeLessThan(0);
  });

  it("loserDelta < 0 for higher-ELO winner", () => {
    expect(calculate(1200, 1000).loserDelta).toBeLessThan(0);
  });

  it("loserDelta < 0 for lower-ELO winner (upset)", () => {
    expect(calculate(800, 1000).loserDelta).toBeLessThan(0);
  });
});
