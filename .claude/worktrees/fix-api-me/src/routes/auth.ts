import { Env } from "../index";
import { authenticate, createSessionCookie } from "../auth/middleware";
import { titleProgress } from "../modules/TitleEngine";

const GUEST_ADJECTIVES = [
  'Swift', 'Nimble', 'Bold', 'Clever', 'Sharp', 'Bright', 'Keen', 'Quick',
  'Crafty', 'Witty', 'Sly', 'Deft', 'Agile', 'Brisk', 'Snappy', 'Spry',
  'Fierce', 'Wild', 'Slick', 'Wily', 'Zany', 'Plucky', 'Gutsy', 'Zippy',
  'Brash', 'Feisty', 'Gritty', 'Jazzy', 'Peppy', 'Sassy',
];

const GUEST_NOUNS = [
  'Fox', 'Lynx', 'Hawk', 'Wolf', 'Otter', 'Raven', 'Falcon', 'Viper',
  'Drake', 'Panda', 'Jackal', 'Coyote', 'Bobcat', 'Ferret', 'Crane',
  'Mink', 'Heron', 'Stork', 'Ibis', 'Kite', 'Gecko', 'Dingo', 'Marten',
  'Stoat', 'Finch', 'Quail', 'Bison', 'Moose', 'Tapir', 'Okapi',
];

function generateGuestName(): string {
  const adj = GUEST_ADJECTIVES[Math.floor(Math.random() * GUEST_ADJECTIVES.length)];
  const noun = GUEST_NOUNS[Math.floor(Math.random() * GUEST_NOUNS.length)];
  const num = Math.floor(Math.random() * 99) + 1;
  return `${adj}${noun}${num}`;
}

export async function handleMe(request: Request, env: Env): Promise<Response> {
  const session = await authenticate(request, env);

  if (!session) {
    const playerId = crypto.randomUUID();
    const displayName = generateGuestName();
    const now = Date.now();

    await env.DB.prepare(
      "INSERT INTO players (id, display_name, elo, created_at) VALUES (?, ?, ?, ?)"
    )
      .bind(playerId, displayName, 1000, now)
      .run();

    const cookie = await createSessionCookie(playerId, env);

    const progress = titleProgress(0);
    return Response.json(
      {
        id: playerId,
        display_name: displayName,
        elo: 1000,
        google_linked: false,
        xp: 0,
        total_wins: 0,
        title: progress.current,
        next_title: progress.next ?? null,
        wins_to_next_title: progress.winsToNext ?? null,
      },
      { headers: { "Set-Cookie": cookie } }
    );
  }

  const player = await env.DB.prepare(
    "SELECT id, display_name, elo, linked_oauth_provider, xp, total_wins, title FROM players WHERE id = ?"
  )
    .bind(session.playerId)
    .first<{
      id: string;
      display_name: string;
      elo: number;
      linked_oauth_provider: string | null;
      xp: number | null;
      total_wins: number | null;
      title: string | null;
    }>();

  if (!player) {
    return new Response("Player not found", { status: 404 });
  }

  const totalWins = player.total_wins ?? 0;
  const progress = titleProgress(totalWins);

  return Response.json({
    id: player.id,
    display_name: player.display_name,
    elo: player.elo,
    google_linked: !!player.linked_oauth_provider,
    xp: player.xp ?? 0,
    total_wins: totalWins,
    title: progress.current,
    next_title: progress.next ?? null,
    wins_to_next_title: progress.winsToNext ?? null,
  });
}

export async function handleUpdateMe(request: Request, env: Env): Promise<Response> {
  const session = await authenticate(request, env);
  if (!session) return new Response("Unauthorized", { status: 401 });

  let body: { display_name?: unknown };
  try {
    body = await request.json() as { display_name?: unknown };
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const name = typeof body.display_name === "string" ? body.display_name.trim() : null;
  if (!name || name.length < 2 || name.length > 24) {
    return new Response("display_name must be 2–24 characters", { status: 400 });
  }
  if (!/^[a-zA-Z0-9 _-]+$/.test(name)) {
    return new Response("display_name contains invalid characters", { status: 400 });
  }

  await env.DB.prepare("UPDATE players SET display_name = ? WHERE id = ?")
    .bind(name, session.playerId)
    .run();

  return Response.json({ display_name: name });
}
