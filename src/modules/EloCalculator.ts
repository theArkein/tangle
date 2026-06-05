export interface EloResult {
  winnerDelta: number;
  loserDelta: number;
}

export function calculate(winnerElo: number, loserElo: number): EloResult {
  const expectedWinner = 1 / (1 + 10 ** ((loserElo - winnerElo) / 400));
  const winnerDelta = Math.round(32 * (1 - expectedWinner));
  const loserDelta = -winnerDelta;
  return { winnerDelta, loserDelta };
}
