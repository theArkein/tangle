import { describe, it, expect } from "vitest";
import {
  getModeConfig,
  isValidGameMode,
  ALL_MODES,
} from "../../src/modules/gameModes";

describe("gameModes", () => {
  it("returns duel config with 25s turns, best-of-5, power-ups on", () => {
    const cfg = getModeConfig("duel");
    expect(cfg.turnTimeoutMs).toBe(25_000);
    expect(cfg.roundsToWinMatch).toBe(3);
    expect(cfg.powerUpsEnabled).toBe(true);
  });

  it("returns classic config with 8s turns, single round, power-ups off", () => {
    const cfg = getModeConfig("classic");
    expect(cfg.turnTimeoutMs).toBe(8_000);
    expect(cfg.roundsToWinMatch).toBe(1);
    expect(cfg.powerUpsEnabled).toBe(false);
  });

  it("isValidGameMode accepts the two known modes", () => {
    expect(isValidGameMode("duel")).toBe(true);
    expect(isValidGameMode("classic")).toBe(true);
    expect(isValidGameMode("speed_round")).toBe(false);
    expect(isValidGameMode(123)).toBe(false);
  });

  it("ALL_MODES contains both modes", () => {
    expect([...ALL_MODES].sort()).toEqual(["classic", "duel"]);
  });
});
