export type PowerUpId = "freeze" | "secondLife" | "letterBomb" | "block";

export type Category = "defensive" | "offensive" | "disruption" | "chaos";
export type Rarity = "common" | "uncommon" | "rare";

export type PlayerId = string;

export interface PowerUpInventory {
  freeze: number;
  secondLife: number;
  letterBomb: number;
  block: number;
}

export type ActiveEffect =
  | { kind: "freeze"; onPlayerId: PlayerId; expiresAt: number }
  | { kind: "secondLifeArmed"; forPlayerId: PlayerId }
  | { kind: "letterBomb"; onPlayerId: PlayerId; requiredLetter: string };

export interface DropTriggers {
  thresholdsCrossed: Record<PlayerId, number>;
  rareLetterDropped: Record<PlayerId, boolean>;
  longWordDropped: Record<PlayerId, boolean>;
}

export interface PowerUpDrop {
  playerId: PlayerId;
  id: PowerUpId;
  source: "score_threshold" | "rare_letter" | "long_word";
}

export interface ScoreBreakdown {
  base: number;
  rareLetter: number;
  longWord: number;
}

export interface PowerUpDefinition {
  id: PowerUpId;
  name: string;
  category: Category;
  rarity: Rarity;
  description: string;
}

export function emptyInventory(): PowerUpInventory {
  return { freeze: 0, secondLife: 0, letterBomb: 0, block: 0 };
}

export function emptyTriggers(player1Id: PlayerId, player2Id: PlayerId): DropTriggers {
  return {
    thresholdsCrossed: { [player1Id]: 0, [player2Id]: 0 },
    rareLetterDropped: { [player1Id]: false, [player2Id]: false },
    longWordDropped: { [player1Id]: false, [player2Id]: false },
  };
}
