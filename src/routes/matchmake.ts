import type { Env } from "../index";
import { authenticate } from "../auth/middleware";
import { isValidGameMode, type GameMode } from "../modules/gameModes";
import { getMatchmakerStub } from "../durable-objects/Matchmaker";

// The route handler is thin: parse the request, authenticate, and forward to
// the Matchmaker DO. All atomicity lives in the DO.
export async function handleMatchmake(
  request: Request,
  env: Env
): Promise<Response> {
  const auth = await authenticate(request, env);
  if (!auth) return new Response("Unauthorized", { status: 401 });
  const { playerId } = auth;

  const stub = getMatchmakerStub(env);

  if (request.method === "POST") {
    let body: { mode?: unknown } = {};
    try {
      body = (await request.json()) as { mode?: unknown };
    } catch {
      // No body is fine — default to classic
    }
    const mode: GameMode = isValidGameMode(body.mode) ? body.mode : "classic";
    return stub.fetch("https://matchmaker/?op=enqueue", {
      method: "POST",
      body: JSON.stringify({ playerId, mode }),
    });
  }

  const url = new URL(request.url);
  const token = url.pathname.split("/").pop();
  if (request.method === "GET" && token && token !== "matchmake") {
    return stub.fetch("https://matchmaker/?op=poll", {
      method: "POST",
      body: JSON.stringify({ token, playerId }),
    });
  }

  return new Response("Not found", { status: 404 });
}
