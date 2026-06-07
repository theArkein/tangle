import type { Env } from "../index";
import { authenticate } from "../auth/middleware";
import { isValidGameMode, type GameMode } from "../modules/gameModes";

const QUEUE_PREFIX = "queue:head:";
const MATCH_PREFIX = "match:";
const QUEUE_TTL_SECONDS = 60;
const MATCH_TTL_SECONDS = 120;

interface QueueEntry {
  playerId: string;
  token: string;
  mode: GameMode;
}

interface MatchEntry {
  status: "waiting" | "matched";
  roomId?: string;
  mode?: GameMode;
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

function queueKey(mode: GameMode): string {
  return `${QUEUE_PREFIX}${mode}`;
}

export async function handleMatchmake(
  request: Request,
  env: Env
): Promise<Response> {
  const auth = await authenticate(request, env);
  if (!auth) return new Response("Unauthorized", { status: 401 });
  const { playerId } = auth;

  if (request.method === "POST") {
    let body: { mode?: unknown } = {};
    try {
      body = (await request.json()) as { mode?: unknown };
    } catch {
      // No body is fine — default to classic
    }
    const mode: GameMode = isValidGameMode(body.mode) ? body.mode : "classic";
    return enqueue(playerId, mode, env);
  }

  const url = new URL(request.url);
  const token = url.pathname.split("/").pop();
  if (request.method === "GET" && token && token !== "matchmake") {
    return pollMatch(token, playerId, env);
  }

  return new Response("Not found", { status: 404 });
}

async function enqueue(
  playerId: string,
  mode: GameMode,
  env: Env
): Promise<Response> {
  const key = queueKey(mode);
  const raw = await env.KV.get(key);
  if (raw) {
    const waiting = JSON.parse(raw) as QueueEntry;
    if (waiting.playerId !== playerId) {
      const roomId = generateToken();
      await env.KV.delete(key);
      const matchEntry: MatchEntry = { status: "matched", roomId, mode };
      const matchJson = JSON.stringify(matchEntry);
      await Promise.all([
        env.KV.put(`${MATCH_PREFIX}${waiting.token}`, matchJson, {
          expirationTtl: MATCH_TTL_SECONDS,
        }),
      ]);
      // Stash the mode on the room so the DO can read it when the first WS arrives.
      await env.KV.put(`${MATCH_PREFIX}room:${roomId}:mode`, mode, {
        expirationTtl: MATCH_TTL_SECONDS,
      });
      return Response.json({ status: "matched", roomId, mode });
    }
    const existingMatch = await env.KV.get(`${MATCH_PREFIX}${waiting.token}`);
    if (existingMatch) {
      return Response.json({ status: "pending", token: waiting.token, mode });
    }
  }

  const token = generateToken();
  const entry: QueueEntry = { playerId, token, mode };
  const matchEntry: MatchEntry = { status: "waiting", mode };

  await Promise.all([
    env.KV.put(key, JSON.stringify(entry), { expirationTtl: QUEUE_TTL_SECONDS }),
    env.KV.put(`${MATCH_PREFIX}${token}`, JSON.stringify(matchEntry), {
      expirationTtl: QUEUE_TTL_SECONDS,
    }),
  ]);

  return Response.json({ status: "pending", token, mode });
}

async function pollMatch(
  token: string,
  playerId: string,
  env: Env
): Promise<Response> {
  const matchKey = `${MATCH_PREFIX}${token}`;
  const raw = await env.KV.get(matchKey);
  if (!raw) {
    return Response.json({ status: "timeout" });
  }
  const entry = JSON.parse(raw) as MatchEntry;
  if (entry.status === "matched" || !entry.mode) {
    return Response.json(entry);
  }

  // Self-heal a KV race: if two players POSTed simultaneously, each may have
  // seen an empty queue and enqueued themselves. The second write overwrote
  // the first, leaving both polling forever. On every poll, re-check the queue
  // and pair up if we find a different waiting player.
  const key = queueKey(entry.mode);
  const queueRaw = await env.KV.get(key);
  if (queueRaw) {
    const queued = JSON.parse(queueRaw) as QueueEntry;
    if (queued.playerId !== playerId && queued.token !== token) {
      const roomId = generateToken();
      const matched: MatchEntry = { status: "matched", roomId, mode: entry.mode };
      const matchJson = JSON.stringify(matched);
      await Promise.all([
        env.KV.delete(key),
        env.KV.put(`${MATCH_PREFIX}${queued.token}`, matchJson, {
          expirationTtl: MATCH_TTL_SECONDS,
        }),
        env.KV.put(matchKey, matchJson, { expirationTtl: MATCH_TTL_SECONDS }),
        env.KV.put(`${MATCH_PREFIX}room:${roomId}:mode`, entry.mode, {
          expirationTtl: MATCH_TTL_SECONDS,
        }),
      ]);
      return Response.json(matched);
    }
  } else {
    // Queue lost our slot (TTL expired or overwritten by a same-player retry).
    // Re-claim it so a future joiner can find us.
    const reentry: QueueEntry = { playerId, token, mode: entry.mode };
    await Promise.all([
      env.KV.put(key, JSON.stringify(reentry), {
        expirationTtl: QUEUE_TTL_SECONDS,
      }),
      env.KV.put(matchKey, raw, { expirationTtl: QUEUE_TTL_SECONDS }),
    ]);
  }

  return Response.json(entry);
}
