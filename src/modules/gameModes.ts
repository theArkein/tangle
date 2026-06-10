export type GameMode = "duel" | "classic";

export interface GameModeConfig {
  mode: GameMode;
  displayName: string;
  turnTimeoutMs: number;
  roundsToWinMatch: number;
  powerUpsEnabled: boolean;
}

const DUEL: GameModeConfig = {
  mode: "duel",
  displayName: "Duel",
  turnTimeoutMs: 25_000,
  roundsToWinMatch: 3,
  powerUpsEnabled: true,
};

const CLASSIC: GameModeConfig = {
  mode: "classic",
  displayName: "Classic",
  turnTimeoutMs: 8_000,
  roundsToWinMatch: 1,
  powerUpsEnabled: false,
};

const CONFIGS: Record<GameMode, GameModeConfig> = {
  duel: DUEL,
  classic: CLASSIC,
};

export function getModeConfig(mode: GameMode): GameModeConfig {
  return CONFIGS[mode];
}

export function isValidGameMode(value: unknown): value is GameMode {
  return value === "duel" || value === "classic";
}

export const ALL_MODES: readonly GameMode[] = ["duel", "classic"] as const;
