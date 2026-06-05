export { GameRoom } from "./durable-objects/GameRoom";
import { handleMe } from "./routes/auth";

export interface Env {
  GAME_ROOM: DurableObjectNamespace;
  DB: D1Database;
  KV: KVNamespace;
  JWT_SECRET: string;
  ENVIRONMENT: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return Response.json({ status: "ok", env: env.ENVIRONMENT });
    }

    if (url.pathname === "/api/me") {
      return handleMe(request, env);
    }

    if (url.pathname.startsWith("/api/rooms")) {
      return handleRooms(request, env, url);
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

async function handleRooms(
  request: Request,
  env: Env,
  url: URL
): Promise<Response> {
  const roomMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)(\/.*)?$/);

  if (request.method === "POST" && url.pathname === "/api/rooms") {
    const id = env.GAME_ROOM.newUniqueId();
    const stub = env.GAME_ROOM.get(id);
    return stub.fetch(request);
  }

  if (roomMatch) {
    const [, roomSlug, rest] = roomMatch;
    const id = env.GAME_ROOM.idFromName(roomSlug ?? "");
    const stub = env.GAME_ROOM.get(id);
    const roomUrl = new URL(request.url);
    roomUrl.pathname = rest ?? "/";
    return stub.fetch(new Request(roomUrl, request));
  }

  return new Response("Not found", { status: 404 });
}
