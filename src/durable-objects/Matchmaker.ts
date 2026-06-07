import type { Env } from "../index";
import type { GameMode } from "../modules/gameModes";
import { isValidGameMode } from "../modules/gameModes";

// Matchmaker is a single-instance Durable Object that owns all matchmaking
// state. Because a DO instance is single-threaded, every operation runs to
// completion before the next one starts — which gives us atomic queue
// mutations that KV alone cannot. (KV is eventually consistent and has no
// compare-and-swap, so two concurrent POSTs both seeing "queue empty" and
// each enqueuing themselves was a real bug.)
//
// We still write `match:room:{roomId}:mode` into KV at pair time so the
// GameRoom DO can look up the mode when the first WebSocket arrives. There
// is no race on that key — every roomId is unique.

interface QueueEntry {
  playerId: string;
  token: string;
  enqueuedAt: number;
}

interface MatchEntry {
  status: "waiting" | "matched";
  roomId?: string;
  mode: GameMode;
  createdAt: number;
}

const QUEUE_KEY_PREFIX = "queue:";
const MATCH_KEY_PREFIX = "match:";
const ROOM_MODE_KV_PREFIX = "match:room:";
const STALE_QUEUE_MS = 60_000;
const STALE_MATCH_MS = 120_000;
const ROOM_MODE_TTL_SECONDS = 120;

function generateToken(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
    .slice(0, 16);
}

export class Matchmaker {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const op = url.searchParams.get("op");
    if (request.method === "POST" && op === "enqueue") {
      const { playerId, mode } = (await request.json()) as {
        playerId: string;
        mode: GameMode;
      };
      return this.enqueue(playerId, mode);
    }
    if (request.method === "POST" && op === "poll") {
      const { token } = (await request.json()) as { token: string };
      return this.poll(token);
    }
    return new Response("not found", { status: 404 });
  }

  // Serialize all matchmaking operations through the DO's input gate so the
  // queue read + write are atomic from the caller's perspective.
  private async enqueue(playerId: string, mode: GameMode): Promise<Response> {
    return this.state.blockConcurrencyWhile(async () => {
      const queueKey = `${QUEUE_KEY_PREFIX}${mode}`;
      const now = Date.now();

      let waiting = await this.state.storage.get<QueueEntry>(queueKey);
      // Drop stale queue entries (a player POSTed but never polled).
      if (waiting && now - waiting.enqueuedAt > STALE_QUEUE_MS) {
        await this.state.storage.delete(queueKey);
        waiting = undefined;
      }

      if (waiting && waiting.playerId === playerId) {
        // Same player re-queueing — return their existing token if the
        // match record is still alive.
        const existing = await this.state.storage.get<MatchEntry>(
          `${MATCH_KEY_PREFIX}${waiting.token}`
        );
        if (existing) {
          return Response.json({ status: "pending", token: waiting.token, mode });
        }
        // Match record evaporated; fall through to enqueue fresh.
      }

      if (waiting && waiting.playerId !== playerId) {
        const roomId = generateToken();
        const matchEntry: MatchEntry = {
          status: "matched",
          roomId,
          mode,
          createdAt: now,
        };
        await this.state.storage.delete(queueKey);
        await this.state.storage.put(
          `${MATCH_KEY_PREFIX}${waiting.token}`,
          matchEntry
        );
        // Stash mode for GameRoom to read; KV write is fire-and-forget,
        // unique-key, no race.
        await this.env.KV.put(`${ROOM_MODE_KV_PREFIX}${roomId}:mode`, mode, {
          expirationTtl: ROOM_MODE_TTL_SECONDS,
        });
        return Response.json({ status: "matched", roomId, mode });
      }

      // Queue empty — enqueue self.
      const token = generateToken();
      const entry: QueueEntry = { playerId, token, enqueuedAt: now };
      const matchEntry: MatchEntry = { status: "waiting", mode, createdAt: now };
      await this.state.storage.put(queueKey, entry);
      await this.state.storage.put(`${MATCH_KEY_PREFIX}${token}`, matchEntry);
      return Response.json({ status: "pending", token, mode });
    });
  }

  private async poll(token: string): Promise<Response> {
    return this.state.blockConcurrencyWhile(async () => {
      const entry = await this.state.storage.get<MatchEntry>(
        `${MATCH_KEY_PREFIX}${token}`
      );
      if (!entry) {
        return Response.json({ status: "timeout" });
      }
      const now = Date.now();
      if (now - entry.createdAt > STALE_MATCH_MS) {
        await this.state.storage.delete(`${MATCH_KEY_PREFIX}${token}`);
        return Response.json({ status: "timeout" });
      }
      if (entry.status === "matched") {
        return Response.json({ status: "matched", roomId: entry.roomId, mode: entry.mode });
      }
      return Response.json({ status: "waiting", mode: entry.mode });
    });
  }
}

export function getMatchmakerStub(env: Env): DurableObjectStub {
  // Single global instance keyed by a fixed name. The DO's single-threaded
  // execution serializes all matchmaking ops site-wide.
  const id = env.MATCHMAKER.idFromName("global");
  return env.MATCHMAKER.get(id);
}

// Re-exported for the route handler to avoid coupling to internal details.
export { isValidGameMode };
