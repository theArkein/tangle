import { describe, it, expect } from "vitest";
import {
  getModeConfig,
  isValidGameMode,
  ALL_MODES,
} from "../../src/modules/gameModes";

describe("gameModes", () => {
  it("returns classic config with 60s turns, 8 faults, best-of-5, power-ups on", () => {
    const cfg = getModeConfig("classic");
    expect(cfg.turnTimeoutMs).toBe(60_000);
    expect(cfg.faultsToLoseRound).toBe(8);
    expect(cfg.roundsToWinMatch).toBe(3);
    expect(cfg.powerUpsEnabled).toBe(true);
  });

  it("returns speed_round config with 8s turns, 1 fault, single round, power-ups off", () => {
    const cfg = getModeConfig("speed_round");
    expect(cfg.turnTimeoutMs).toBe(8_000);
    expect(cfg.faultsToLoseRound).toBe(1);
    expect(cfg.roundsToWinMatch).toBe(1);
    expect(cfg.powerUpsEnabled).toBe(false);
  });

  it("isValidGameMode accepts the two known modes", () => {
    expect(isValidGameMode("classic")).toBe(true);
    expect(isValidGameMode("speed_round")).toBe(true);
    expect(isValidGameMode("ranked")).toBe(false);
    expect(isValidGameMode(123)).toBe(false);
  });

  it("ALL_MODES contains both modes", () => {
    expect([...ALL_MODES].sort()).toEqual(["classic", "speed_round"]);
  });
});
