export interface XPGrantInput {
  isWinner: boolean;
  reachedDangerZone?: boolean;
}

export interface XPBreakdown {
  base: number;
  dangerZone: number;
}

export interface XPGrant {
  total: number;
  breakdown: XPBreakdown;
}

const WIN_XP = 100;
const LOSS_XP = 30;
const DANGER_ZONE_BONUS = 50;

export function calculateXP(input: XPGrantInput): XPGrant {
  const base = input.isWinner ? WIN_XP : LOSS_XP;
  const dangerZone = input.reachedDangerZone ? DANGER_ZONE_BONUS : 0;
  return {
    total: base + dangerZone,
    breakdown: { base, dangerZone },
  };
}
