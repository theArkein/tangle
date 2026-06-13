import { EXTEND } from "./freeze";
import { SECOND_LIFE } from "./secondLife";
import { LETTER_BOMB } from "./letterBomb";
import { DOUBLE } from "./double";
import { WILD } from "./wild";
import { ANCHOR } from "./anchor";
import { TAX } from "./tax";
import type { PowerUpDefinition, PowerUpId } from "./types";

export const REGISTRY: readonly PowerUpDefinition[] = [
  EXTEND,
  SECOND_LIFE,
  LETTER_BOMB,
  DOUBLE,
  WILD,
  ANCHOR,
  TAX,
] as const;

const BY_ID: Map<PowerUpId, PowerUpDefinition> = new Map(
  REGISTRY.map((d) => [d.id, d])
);

export function getDefinition(id: PowerUpId): PowerUpDefinition | undefined {
  return BY_ID.get(id);
}

export * from "./types";
export { EXTEND, EXTEND_DELTA_MS } from "./freeze";
export { SECOND_LIFE } from "./secondLife";
export { LETTER_BOMB } from "./letterBomb";
export { DOUBLE } from "./double";
export { WILD } from "./wild";
export { ANCHOR } from "./anchor";
export { TAX } from "./tax";
