import { Env } from "../index";
import { authenticate, createSessionCookie } from "../auth/middleware";

export async function handleMe(request: Request, env: Env): Promise<Response> {
  const session = await authenticate(request, env);

  if (!session) {
    const playerId = crypto.randomUUID();
    const hexChars = Math.floor(Math.random() * 0xffff)
      .toString(16)
      .padStart(4, "0");
    const displayName = `Player_${hexChars}`;
    const now = Date.now();

    await env.DB.prepare(
      "INSERT INTO players (id, display_name, elo, created_at) VALUES (?, ?, ?, ?)"
    )
      .bind(playerId, displayName, 1000, now)
      .run();

    const cookie = await createSessionCookie(playerId, env);

    return Response.json(
      { id: playerId, display_name: displayName, elo: 1000 },
      { headers: { "Set-Cookie": cookie } }
    );
  }

  const player = await env.DB.prepare(
    "SELECT id, display_name, elo, linked_oauth_provider FROM players WHERE id = ?"
  )
    .bind(session.playerId)
    .first<{ id: string; display_name: string; elo: number; linked_oauth_provider: string | null }>();

  if (!player) {
    return new Response("Player not found", { status: 404 });
  }

  return Response.json({
    id: player.id,
    display_name: player.display_name,
    elo: player.elo,
    google_linked: !!player.linked_oauth_provider,
  });
}
