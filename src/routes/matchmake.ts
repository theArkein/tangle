import type { Env } from "../index";
import { authenticate } from "../auth/middleware";

const QUEUE_KEY = "queue:head";
const MATCH_PREFIX = "match:";
const QUEUE_TTL_SECONDS = 60;
const MATCH_TTL_SECONDS = 120;

interface QueueEntry {
  playerId: string;
  token: string;
}

interface MatchEntry {
  status: "waiting" | "matched";
  roomId?: string;
}

function generateToken(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
    .slice(0, 16);
}

export async function handleMatchmake(
  request: Request,
  env: Env
): Promise<Response> {
  const auth = await authenticate(request, env);
  if (!auth) return new Response("Unauthorized", { status: 401 });
  const { playerId } = auth;

  if (request.method === "POST") {
    return enqueue(playerId, env);
  }

  const url = new URL(request.url);
  const token = url.pathname.split("/").pop();
  if (request.method === "GET" && token) {
    return pollMatch(token, env);
  }

  return new Response("Not found", { status: 404 });
}

async function enqueue(playerId: string, env: Env): Promise<Response> {
  const raw = await env.KV.get(QUEUE_KEY);
  if (raw) {
    const waiting = JSON.parse(raw) as QueueEntry;
    if (waiting.playerId !== playerId) {
      // Pair them: create a room and notify both via their match entries
      const roomId = generateToken();
      await env.KV.delete(QUEUE_KEY);
      const matchEntry: MatchEntry = { status: "matched", roomId };
      const matchJson = JSON.stringify(matchEntry);
      await Promise.all([
        env.KV.put(`${MATCH_PREFIX}${waiting.token}`, matchJson, {
          expirationTtl: MATCH_TTL_SECONDS,
        }),
      ]);
      return Response.json({ status: "matched", roomId });
    }
    // Same player re-queued — return their existing token
    const existingMatch = await env.KV.get(
      `${MATCH_PREFIX}${waiting.token}`
    );
    if (existingMatch) {
      return Response.json({ status: "pending", token: waiting.token });
    }
  }

  // No waiting player (or same player had stale entry): enqueue
  const token = generateToken();
  const entry: QueueEntry = { playerId, token };
  const matchEntry: MatchEntry = { status: "waiting" };

  await Promise.all([
    env.KV.put(QUEUE_KEY, JSON.stringify(entry), {
      expirationTtl: QUEUE_TTL_SECONDS,
    }),
    env.KV.put(`${MATCH_PREFIX}${token}`, JSON.stringify(matchEntry), {
      expirationTtl: QUEUE_TTL_SECONDS,
    }),
  ]);

  return Response.json({ status: "pending", token });
}

async function pollMatch(token: string, env: Env): Promise<Response> {
  const raw = await env.KV.get(`${MATCH_PREFIX}${token}`);
  if (!raw) {
    return Response.json({ status: "timeout" });
  }
  const entry = JSON.parse(raw) as MatchEntry;
  return Response.json(entry);
}
