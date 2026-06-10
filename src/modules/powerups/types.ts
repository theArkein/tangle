export type PowerUpId =
  | "secondLife"
  | "letterBomb"
  | "double"
  | "wild"
  | "anchor"
  | "tax"
  | "freeze";

export type Category = "defensive" | "offensive" | "disruption";
export type Rarity = "common" | "uncommon" | "rare";

export type PlayerId = string;

export type PowerUpInventory = Record<PowerUpId, number>;

export type ActiveEffect =
  | { kind: "letterBomb"; onPlayerId: PlayerId; requiredLetter: string }
  | { kind: "doubleScore"; forPlayerId: PlayerId; wordsRemaining: number }
  | { kind: "wildPending"; forPlayerId: PlayerId }
  | { kind: "anchor"; onPlayerId: PlayerId; minLength: number };

export interface DropTriggers {
  // floor(cumulativeScore / 25) last recorded per player — used to detect new 25pt milestones
  playerFreezeThresholds: Record<PlayerId, number>;
  // words played by each player this round — used to detect Wild (every 6th word)
  playerWordCounts: Record<PlayerId, number>;
}

export interface PowerUpDrop {
  playerId: PlayerId;
  id: PowerUpId;
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
    secondLife: 0,
    letterBomb: 0,
    double: 0,
    wild: 0,
    anchor: 0,
    tax: 0,
    freeze: 0,
  };
}

export function emptyTriggers(player1Id: PlayerId, player2Id: PlayerId): DropTriggers {
  return {
    playerFreezeThresholds: { [player1Id]: 0, [player2Id]: 0 },
    playerWordCounts: { [player1Id]: 0, [player2Id]: 0 },
  };
}
