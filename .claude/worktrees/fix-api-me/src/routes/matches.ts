import type { Env } from "../index";
import { authenticate } from "../auth/middleware";

interface MatchRow {
  id: string;
  player1_id: string;
  player2_id: string;
  winner_id: string | null;
  round_scores: string;
  created_at: number;
  opponent_display_name: string;
}

export async function handleMatches(request: Request, env: Env): Promise<Response> {
  const session = await authenticate(request, env);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { playerId } = session;

  const rows = await env.DB.prepare(
    `SELECT
       m.id,
       m.player1_id,
       m.player2_id,
       m.winner_id,
       m.round_scores,
       m.created_at,
       p.display_name AS opponent_display_name
     FROM matches m
     JOIN players p ON p.id = CASE
       WHEN m.player1_id = ? THEN m.player2_id
       ELSE m.player1_id
     END
     WHERE m.player1_id = ? OR m.player2_id = ?
     ORDER BY m.created_at DESC
     LIMIT 10`
  )
    .bind(playerId, playerId, playerId)
    .all<MatchRow>();

  const matches = (rows.results ?? []).map((row) => {
    const roundScores = JSON.parse(row.round_scores) as Record<string, number>;
    const opponentId =
      row.player1_id === playerId ? row.player2_id : row.player1_id;
    return {
      id: row.id,
      opponent: row.opponent_display_name,
      outcome: row.winner_id === playerId ? "win" : "loss",
      roundScores: [roundScores[playerId] ?? 0, roundScores[opponentId] ?? 0],
      date: row.created_at,
    };
  });

  return Response.json(matches);
}
