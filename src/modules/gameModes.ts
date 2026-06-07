export type GameMode = "classic" | "speed_round";

export interface GameModeConfig {
  mode: GameMode;
  displayName: string;
  turnTimeoutMs: number;
  faultsToLoseRound: number;
  roundsToWinMatch: number;
  powerUpsEnabled: boolean;
}

const CLASSIC: GameModeConfig = {
  mode: "classic",
  displayName: "Classic Duel",
  turnTimeoutMs: 60_000,
  faultsToLoseRound: 8,
  roundsToWinMatch: 3,
  powerUpsEnabled: true,
};

const SPEED_ROUND: GameModeConfig = {
  mode: "speed_round",
  displayName: "Speed Round",
  turnTimeoutMs: 8_000,
  faultsToLoseRound: 1,
  roundsToWinMatch: 1,
  powerUpsEnabled: false,
};

const CONFIGS: Record<GameMode, GameModeConfig> = {
  classic: CLASSIC,
  speed_round: SPEED_ROUND,
};

export function getModeConfig(mode: GameMode): GameModeConfig {
  return CONFIGS[mode];
}

export function isValidGameMode(value: unknown): value is GameMode {
  return value === "classic" || value === "speed_round";
}

export const ALL_MODES: readonly GameMode[] = ["classic", "speed_round"] as const;
