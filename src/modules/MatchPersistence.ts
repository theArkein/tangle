import { calculate } from "./EloCalculator";
import { calculateXP } from "./XPCalculator";
import { titleForWins } from "./TitleEngine";
import type { GameMode } from "./gameModes";
import type { Env } from "../index";

export interface WordEntry {
  word: string;
  playerId: string;
  points: number;
  breakdown: { base: number; rareTier1: number; rareTier2: number; rareTier3: number; longWord: number };
}

export interface RoundHistoryEntry {
  roundNumber: number;
  winnerId: string;
  words: WordEntry[];
}

export interface PersistMatchInput {
  player1Id: string;
  player2Id: string;
  winnerId: string;
  roundWins: Record<string, number>;
  roundHistory: RoundHistoryEntry[];
  gameMode?: GameMode;
}

const MAX_MATCHES_PER_PLAYER = 50;
const MAX_BATCH_SIZE = 100;

export async function persistMatch(env: Env, input: PersistMatchInput): Promise<void> {
  const { player1Id, player2Id, winnerId, roundWins, roundHistory } = input;
  const gameMode = input.gameMode ?? "classic";
  const loserId = winnerId === player1Id ? player2Id : player1Id;
  const matchId = crypto.randomUUID();
  const now = Date.now();

  // Insert match row
  await env.DB.prepare(
    "INSERT INTO matches (id, player1_id, player2_id, winner_id, round_scores, created_at, game_mode) VALUES (?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      matchId,
      player1Id,
      player2Id,
      winnerId,
      JSON.stringify(roundWins),
      now,
      gameMode
    )
    .run();

  // Insert match_words in batches
  const wordStatements: D1PreparedStatement[] = [];
  for (const round of roundHistory) {
    for (let i = 0; i < round.words.length; i++) {
      const entry = round.words[i]!;
      wordStatements.push(
        env.DB.prepare(
          "INSERT INTO match_words (id, match_id, round_number, turn_order, word, player_id, points) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(
          crypto.randomUUID(),
          matchId,
          round.roundNumber,
          i,
          entry.word,
          entry.playerId,
          entry.points
        )
      );
    }
  }
  for (let i = 0; i < wordStatements.length; i += MAX_BATCH_SIZE) {
    await env.DB.batch(wordStatements.slice(i, i + MAX_BATCH_SIZE));
  }

  // ELO update
  const [winnerRow, loserRow] = await Promise.all([
    env.DB.prepare("SELECT elo FROM players WHERE id = ?")
      .bind(winnerId)
      .first<{ elo: number }>(),
    env.DB.prepare("SELECT elo FROM players WHERE id = ?")
      .bind(loserId)
      .first<{ elo: number }>(),
  ]);

  const { winnerDelta, loserDelta } = calculate(
    winnerRow?.elo ?? 1000,
    loserRow?.elo ?? 1000
  );

  const winnerXP = calculateXP({ isWinner: true }).total;
  const loserXP = calculateXP({ isWinner: false }).total;

  // Read current win count to compute the post-match title.
  const winnerWinsRow = await env.DB.prepare(
    "SELECT total_wins FROM players WHERE id = ?"
  )
    .bind(winnerId)
    .first<{ total_wins: number }>();
  const newWinnerTotalWins = (winnerWinsRow?.total_wins ?? 0) + 1;
  const newWinnerTitle = titleForWins(newWinnerTotalWins);

  await env.DB.batch([
    env.DB.prepare(
      "UPDATE players SET elo = elo + ?, xp = xp + ?, total_wins = total_wins + 1, title = ? WHERE id = ?"
    ).bind(winnerDelta, winnerXP, newWinnerTitle, winnerId),
    env.DB.prepare("UPDATE players SET elo = elo + ?, xp = xp + ? WHERE id = ?").bind(
      loserDelta,
      loserXP,
      loserId
    ),
  ]);

  // Trim oldest matches if over cap (per player)
  for (const pid of [player1Id, player2Id]) {
    await trimMatchHistory(env, pid);
  }
}

async function trimMatchHistory(env: Env, playerId: string): Promise<void> {
  const result = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM matches WHERE player1_id = ? OR player2_id = ?"
  )
    .bind(playerId, playerId)
    .first<{ count: number }>();

  const excess = (result?.count ?? 0) - MAX_MATCHES_PER_PLAYER;
  if (excess <= 0) return;

  await env.DB.prepare(
    `DELETE FROM matches WHERE id IN (
       SELECT id FROM matches
       WHERE (player1_id = ? OR player2_id = ?)
       ORDER BY created_at ASC
       LIMIT ?
     )`
  )
    .bind(playerId, playerId, excess)
    .run();
}
