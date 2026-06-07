export type PowerUpId =
  | "freeze"
  | "secondLife"
  | "letterBomb"
  | "block"
  | "swap"
  | "blind"
  | "shrink"
  | "rush"
  | "steal"
  | "peek"
  | "blitz"
  | "wildfire";

export type Category = "defensive" | "offensive" | "disruption" | "chaos";
export type Rarity = "common" | "uncommon" | "rare";

export type PlayerId = string;

export type PowerUpInventory = Record<PowerUpId, number>;

export type ActiveEffect =
  | { kind: "freeze"; onPlayerId: PlayerId; expiresAt: number }
  | { kind: "secondLifeArmed"; forPlayerId: PlayerId }
  | { kind: "letterBomb"; onPlayerId: PlayerId; requiredLetter: string }
  | { kind: "swapPending"; byPlayerId: PlayerId }
  | { kind: "blind"; onPlayerId: PlayerId; turnsRemaining: number }
  | { kind: "shrink"; onPlayerId: PlayerId; maxLength: number }
  | { kind: "rush"; onPlayerId: PlayerId }
  | { kind: "peek"; forPlayerId: PlayerId; turnsRemaining: number }
  | { kind: "blitzClaimed"; byPlayerId: PlayerId }
  | { kind: "wildfire"; turnsRemaining: number; multiplier: number };

export interface DropTriggers {
  thresholdsCrossed: Record<PlayerId, number>;
  rareLetterDropped: Record<PlayerId, boolean>;
  longWordDropped: Record<PlayerId, boolean>;
  chainLengthDropped: Record<PlayerId, boolean>;
}

export interface PowerUpDrop {
  playerId: PlayerId;
  id: PowerUpId;
  source: "score_threshold" | "rare_letter" | "long_word" | "chain_length";
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
  return {
    freeze: 0,
    secondLife: 0,
    letterBomb: 0,
    block: 0,
    swap: 0,
    blind: 0,
    shrink: 0,
    rush: 0,
    steal: 0,
    peek: 0,
    blitz: 0,
    wildfire: 0,
  };
}

export function emptyTriggers(player1Id: PlayerId, player2Id: PlayerId): DropTriggers {
  return {
    thresholdsCrossed: { [player1Id]: 0, [player2Id]: 0 },
    rareLetterDropped: { [player1Id]: false, [player2Id]: false },
    longWordDropped: { [player1Id]: false, [player2Id]: false },
    chainLengthDropped: { [player1Id]: false, [player2Id]: false },
  };
}
