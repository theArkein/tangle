import { FREEZE } from "./freeze";
import { SECOND_LIFE } from "./secondLife";
import { LETTER_BOMB } from "./letterBomb";
import { BLOCK } from "./block";
import { SWAP } from "./swap";
import { BLIND } from "./blind";
import { SHRINK } from "./shrink";
import { RUSH } from "./rush";
import { STEAL } from "./steal";
import { PEEK } from "./peek";
import { BLITZ } from "./blitz";
import { WILDFIRE } from "./wildfire";
import type { Category, PowerUpDefinition, PowerUpId } from "./types";

// The declarative power-up catalog. To add a new power-up: create a new
// definition file and add it here.
export const REGISTRY: readonly PowerUpDefinition[] = [
  FREEZE,
  SECOND_LIFE,
  LETTER_BOMB,
  BLOCK,
  SWAP,
  BLIND,
  SHRINK,
  RUSH,
  STEAL,
  PEEK,
  BLITZ,
  WILDFIRE,
] as const;

const BY_ID: Map<PowerUpId, PowerUpDefinition> = new Map(
  REGISTRY.map((d) => [d.id, d])
);

export function getDefinition(id: PowerUpId): PowerUpDefinition | undefined {
  return BY_ID.get(id);
}

export function definitionsForCategory(category: Category): PowerUpDefinition[] {
  return REGISTRY.filter((d) => d.category === category);
}

export * from "./types";
export { FREEZE, FREEZE_DURATION_MS } from "./freeze";
export { SECOND_LIFE } from "./secondLife";
export { LETTER_BOMB, pickHardLetter, wordContainsRequired } from "./letterBomb";
export { BLOCK } from "./block";
export { SWAP } from "./swap";
export { BLIND, BLIND_TURNS } from "./blind";
export { SHRINK, SHRINK_MAX_LENGTH } from "./shrink";
export { RUSH, RUSH_TIMER_FRACTION } from "./rush";
export { STEAL } from "./steal";
export { PEEK, PEEK_TURNS } from "./peek";
export { BLITZ } from "./blitz";
export { WILDFIRE, WILDFIRE_MULTIPLIER, WILDFIRE_TURNS } from "./wildfire";
