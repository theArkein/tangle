export { GameRoom } from "./durable-objects/GameRoom";
export { Matchmaker } from "./durable-objects/Matchmaker";
import { handleMe, handleUpdateMe } from "./routes/auth";
import { handleMatchmake } from "./routes/matchmake";
import { handleMatches } from "./routes/matches";
import { handleGoogleAuth, handleGoogleCallback } from "./routes/oauth";
import { authenticate } from "./auth/middleware";
import { isValidGameMode, type GameMode } from "./modules/gameModes";

export interface Env {
  GAME_ROOM: DurableObjectNamespace;
  MATCHMAKER: DurableObjectNamespace;
  DB: D1Database;
  KV: KVNamespace;
  JWT_SECRET: string;
  ENVIRONMENT: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  DANGER_ZONE_ENABLED?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return Response.json({ status: "ok", env: env.ENVIRONMENT });
    }

    if (url.pathname === "/api/me") {
      if (request.method === "PATCH") return handleUpdateMe(request, env);
      return handleMe(request, env);
    }

    if (url.pathname === "/api/me/matches") {
      return handleMatches(request, env);
    }

    if (url.pathname === "/api/auth/google") {
      return handleGoogleAuth(request, env);
    }

    if (url.pathname === "/api/auth/google/callback") {
      return handleGoogleCallback(request, env);
    }

    if (url.pathname.startsWith("/api/matchmake")) {
      return handleMatchmake(request, env);
    }

    if (url.pathname === "/api/rooms/vs-bot" && request.method === "POST") {
      return handleVsBot(request, env);
    }

    if (url.pathname.startsWith("/api/rooms")) {
      return handleRooms(request, env, url);
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

function generateRoomSlug(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
    .slice(0, 16);
}

async function handleVsBot(request: Request, env: Env): Promise<Response> {
  const auth = await authenticate(request, env);
  if (!auth) return new Response("Unauthorized", { status: 401 });

  let mode: GameMode = "classic";
  try {
    const body = (await request.json()) as { mode?: unknown };
    if (isValidGameMode(body.mode)) mode = body.mode;
  } catch {
    // No body — use classic
  }

  const slug = generateRoomSlug();
  const id = env.GAME_ROOM.idFromName(slug);
  const stub = env.GAME_ROOM.get(id);
  const base = new URL(request.url);

  const initUrl = new URL(base);
  initUrl.pathname = "/init";
  await stub.fetch(
    new Request(initUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    })
  );

  const addBotUrl = new URL(base);
  addBotUrl.pathname = "/add-bot";
  await stub.fetch(new Request(addBotUrl, { method: "POST" }));

  return Response.json({ roomId: slug }, { status: 201 });
}

async function handleRooms(
  request: Request,
  env: Env,
  url: URL
): Promise<Response> {
  const roomMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)(\/.*)?$/);

  if (request.method === "POST" && url.pathname === "/api/rooms") {
    const slug = generateRoomSlug();
    const id = env.GAME_ROOM.idFromName(slug);
    const stub = env.GAME_ROOM.get(id);
    const initUrl = new URL(request.url);
    initUrl.pathname = "/init";
    await stub.fetch(new Request(initUrl, { method: "POST" }));
    return Response.json({ roomId: slug }, { status: 201 });
  }

  if (roomMatch) {
    const [, roomSlug, rest] = roomMatch;

    const id = env.GAME_ROOM.idFromName(roomSlug ?? "");
    const stub = env.GAME_ROOM.get(id);
    const roomUrl = new URL(request.url);
    roomUrl.pathname = rest ?? "/";

    // Guard WebSocket upgrades before forwarding to DO
    if (rest === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket upgrade", { status: 426 });
      }
      const auth = await authenticate(request, env);
      if (!auth) return new Response("Unauthorized", { status: 401 });

      // Pass verified player ID to DO via trusted internal header
      const headers = new Headers(request.headers);
      headers.set("X-Player-Id", auth.playerId);
      return stub.fetch(new Request(roomUrl, { headers, method: request.method }));
    }

    if (rest === "/join" && request.method === "GET") {
      const auth = await authenticate(request, env);
      if (!auth) return new Response("Unauthorized", { status: 401 });
      const headers = new Headers(request.headers);
      headers.set("X-Player-Id", auth.playerId);
      return stub.fetch(new Request(roomUrl, { headers }));
    }

    return stub.fetch(new Request(roomUrl, request));
  }

  return new Response("Not found", { status: 404 });
}
