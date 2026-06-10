import { describe, it, expect } from "vitest";
import { createExecutionContext, waitOnExecutionContext, SELF } from "cloudflare:test";

const TEST_JWT_SECRET = "test-jwt-secret-32-bytes-padding!!";

async function makeSessionCookie(playerId: string): Promise<string> {
  const { signJwt } = await import("../../src/auth/jwt");
  const now = Math.floor(Date.now() / 1000);
  const token = await signJwt({ sub: playerId, exp: now + 3600 }, TEST_JWT_SECRET);
  return `session=${token}`;
}

async function post(playerId: string, mode: string = "classic") {
  const cookie = await makeSessionCookie(playerId);
  const res = await SELF.fetch("http://localhost/api/matchmake", {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  return (await res.json()) as { status: string; token?: string; roomId?: string };
}

async function pollOnce(playerId: string, token: string) {
  const cookie = await makeSessionCookie(playerId);
  const res = await SELF.fetch(`http://localhost/api/matchmake/${token}`, {
    headers: { Cookie: cookie },
  });
  return (await res.json()) as { status: string; roomId?: string };
}

describe("POST /api/matchmake", () => {
  it("returns 401 without a session cookie", async () => {
    const ctx = createExecutionContext();
    const res = await SELF.fetch("http://localhost/api/matchmake", { method: "POST" });
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(401);
  });

  it("enqueues the first player and returns pending + token", async () => {
    const body = await post("player-a");
    expect(body.status).toBe("pending");
    expect(typeof body.token).toBe("string");
    expect((body.token ?? "").length).toBe(16);
  });

  it("pairs two different players and both receive the same room ID", async () => {
    const bodyA = await post("player-pair-a");
    expect(bodyA.status).toBe("pending");

    const bodyB = await post("player-pair-b");
    expect(bodyB.status).toBe("matched");
    expect(typeof bodyB.roomId).toBe("string");

    const pollA = await pollOnce("player-pair-a", bodyA.token!);
    expect(pollA.status).toBe("matched");
    expect(pollA.roomId).toBe(bodyB.roomId);
  });

  it("does not match a player with themselves", async () => {
    const body1 = await post("player-solo");
    expect(body1.status).toBe("pending");

    const body2 = await post("player-solo");
    expect(body2.status).toBe("pending");
  });
});

describe("GET /api/matchmake/:token", () => {
  it("returns 401 without session cookie", async () => {
    const ctx = createExecutionContext();
    const res = await SELF.fetch("http://localhost/api/matchmake/sometoken");
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(401);
  });

  it("returns timeout for unknown or expired token", async () => {
    const body = await pollOnce("player-x", "nonexistenttoken1");
    expect(body.status).toBe("timeout");
  });

  it("returns waiting while no opponent has appeared", async () => {
    const enqueue = await post("player-wait");
    const poll = await pollOnce("player-wait", enqueue.token!);
    expect(poll.status).toBe("waiting");
  });
});

describe("Matchmaking under concurrency", () => {
  // The Matchmaker DO serializes all matchmaking operations, so even with
  // many players hitting Play at the same time, pairing is deterministic
  // and no player is left in a stranded state.

  it("pairs N=6 players hitting Play concurrently into 3 distinct rooms", async () => {
    const players = ["c6-1", "c6-2", "c6-3", "c6-4", "c6-5", "c6-6"];
    const responses = await Promise.all(players.map((p) => post(p)));

    const matchedDirect = responses.filter((r) => r.status === "matched");
    const stillPending = responses.filter((r) => r.status === "pending");
    // With serialized pairing, every pair is formed at POST time — 3 of the
    // 6 POSTs return matched, the other 3 return pending. They poll and find
    // their match record updated.
    expect(matchedDirect).toHaveLength(3);
    expect(stillPending).toHaveLength(3);

    // Poll the pending ones — all should resolve to matched with the same
    // roomId as their partner.
    const allRooms = new Set(matchedDirect.map((r) => r.roomId));
    for (let i = 0; i < responses.length; i++) {
      if (responses[i]!.status === "pending") {
        const poll = await pollOnce(players[i]!, responses[i]!.token!);
        expect(poll.status).toBe("matched");
        allRooms.add(poll.roomId);
      }
    }
    expect(allRooms.size).toBe(3);
  });

  it("leaves exactly one player waiting on odd N=5", async () => {
    const players = ["c5-1", "c5-2", "c5-3", "c5-4", "c5-5"];
    const responses = await Promise.all(players.map((p) => post(p)));

    const matched = responses.filter((r) => r.status === "matched");
    const pending = responses.filter((r) => r.status === "pending");
    expect(matched).toHaveLength(2);
    expect(pending).toHaveLength(3);

    // Poll all pending ones; exactly one should still be waiting (the
    // odd-one-out queue head).
    const pollResults: string[] = [];
    for (let i = 0; i < responses.length; i++) {
      if (responses[i]!.status === "pending") {
        const poll = await pollOnce(players[i]!, responses[i]!.token!);
        pollResults.push(poll.status);
      }
    }
    const stillWaiting = pollResults.filter((s) => s === "waiting").length;
    const finallyMatched = pollResults.filter((s) => s === "matched").length;
    expect(stillWaiting).toBe(1);
    expect(finallyMatched).toBe(2);
  });

  it("keeps Duel and Classic queues isolated — they never cross-match", async () => {
    const duel = await post("isolated-duel", "duel");
    const classic = await post("isolated-classic", "classic");
    // Both pending, neither sees the other.
    expect(duel.status).toBe("pending");
    expect(classic.status).toBe("pending");
    const pollA = await pollOnce("isolated-duel", duel.token!);
    expect(pollA.status).toBe("waiting");
  });

  it("pairs N=10 concurrent players into 5 distinct rooms", async () => {
    const players = Array.from({ length: 10 }, (_, i) => `c10-${i}`);
    const responses = await Promise.all(players.map((p) => post(p)));

    // Poll any still-pending players.
    const rooms = new Set<string>();
    for (let i = 0; i < responses.length; i++) {
      let result = responses[i]!;
      if (result.status === "pending") {
        result = await pollOnce(players[i]!, result.token!);
      }
      expect(result.status).toBe("matched");
      rooms.add(result.roomId!);
    }
    expect(rooms.size).toBe(5);
  });
});
