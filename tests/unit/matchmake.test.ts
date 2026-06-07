import { describe, it, expect } from "vitest";
import { createExecutionContext, waitOnExecutionContext, SELF } from "cloudflare:test";

const TEST_JWT_SECRET = "test-jwt-secret-32-bytes-padding!!";

async function makeSessionCookie(playerId: string): Promise<string> {
  const { signJwt } = await import("../../src/auth/jwt");
  const now = Math.floor(Date.now() / 1000);
  const token = await signJwt({ sub: playerId, exp: now + 3600 }, TEST_JWT_SECRET);
  return `session=${token}`;
}

describe("POST /api/matchmake", () => {
  it("returns 401 without a session cookie", async () => {
    const ctx = createExecutionContext();
    const res = await SELF.fetch("http://localhost/api/matchmake", { method: "POST" });
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(401);
  });

  it("enqueues the first player and returns pending + token", async () => {
    const ctx = createExecutionContext();
    const cookie = await makeSessionCookie("player-a");
    const res = await SELF.fetch("http://localhost/api/matchmake", {
      method: "POST",
      headers: { Cookie: cookie },
    });
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; token?: string };
    expect(body.status).toBe("pending");
    expect(typeof body.token).toBe("string");
    expect((body.token ?? "").length).toBe(16);
  });

  it("pairs two different players and both receive the same room ID", async () => {
    const ctx = createExecutionContext();
    const cookieA = await makeSessionCookie("player-pair-a");
    const cookieB = await makeSessionCookie("player-pair-b");

    const resA = await SELF.fetch("http://localhost/api/matchmake", {
      method: "POST",
      headers: { Cookie: cookieA },
    });
    const bodyA = (await resA.json()) as { status: string; token: string };
    expect(bodyA.status).toBe("pending");

    const resB = await SELF.fetch("http://localhost/api/matchmake", {
      method: "POST",
      headers: { Cookie: cookieB },
    });
    const bodyB = (await resB.json()) as { status: string; roomId?: string };
    expect(bodyB.status).toBe("matched");
    expect(typeof bodyB.roomId).toBe("string");

    // First player's token now resolves to matched with the same room ID
    const pollRes = await SELF.fetch(
      `http://localhost/api/matchmake/${bodyA.token}`,
      { headers: { Cookie: cookieA } }
    );
    await waitOnExecutionContext(ctx);
    const pollBody = (await pollRes.json()) as { status: string; roomId?: string };
    expect(pollBody.status).toBe("matched");
    expect(pollBody.roomId).toBe(bodyB.roomId);
  });

  it("does not match a player with themselves", async () => {
    const ctx = createExecutionContext();
    const cookie = await makeSessionCookie("player-solo");

    const res1 = await SELF.fetch("http://localhost/api/matchmake", {
      method: "POST",
      headers: { Cookie: cookie },
    });
    const body1 = (await res1.json()) as { status: string; token: string };
    expect(body1.status).toBe("pending");

    const res2 = await SELF.fetch("http://localhost/api/matchmake", {
      method: "POST",
      headers: { Cookie: cookie },
    });
    await waitOnExecutionContext(ctx);
    const body2 = (await res2.json()) as { status: string };
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
    const ctx = createExecutionContext();
    const cookie = await makeSessionCookie("player-x");
    const res = await SELF.fetch(
      "http://localhost/api/matchmake/nonexistenttoken1",
      { headers: { Cookie: cookie } }
    );
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("timeout");
  });

  it("self-heals a stuck-waiting race by pairing on poll", async () => {
    // Simulate the KV race: directly seed two stranded waiting entries so that
    // both players have pending tokens but the queue head only points at one
    // of them. Without self-heal, both would poll forever; with it, the polling
    // player pairs with whoever is currently in the queue.
    const { env } = await import("cloudflare:test");
    type Env = typeof env & { KV: KVNamespace };
    const kv = (env as unknown as Env).KV;

    const playerStuck = "player-stuck-a";
    const playerInQueue = "player-stuck-b";
    const tokenStuck = "stuck-token-aaaa";
    const tokenQueued = "queued-token-bb";

    await kv.put(
      `match:${tokenStuck}`,
      JSON.stringify({ status: "waiting", mode: "classic" }),
      { expirationTtl: 60 }
    );
    await kv.put(
      `match:${tokenQueued}`,
      JSON.stringify({ status: "waiting", mode: "classic" }),
      { expirationTtl: 60 }
    );
    await kv.put(
      "queue:head:classic",
      JSON.stringify({ playerId: playerInQueue, token: tokenQueued, mode: "classic" }),
      { expirationTtl: 60 }
    );

    const ctx = createExecutionContext();
    const cookie = await makeSessionCookie(playerStuck);
    const res = await SELF.fetch(
      `http://localhost/api/matchmake/${tokenStuck}`,
      { headers: { Cookie: cookie } }
    );
    await waitOnExecutionContext(ctx);

    const body = (await res.json()) as { status: string; roomId?: string };
    expect(body.status).toBe("matched");
    expect(typeof body.roomId).toBe("string");

    // The other player polling their own token now also sees matched
    // with the same roomId.
    const cookieB = await makeSessionCookie(playerInQueue);
    const pollB = await SELF.fetch(
      `http://localhost/api/matchmake/${tokenQueued}`,
      { headers: { Cookie: cookieB } }
    );
    const bodyB = (await pollB.json()) as { status: string; roomId?: string };
    expect(bodyB.status).toBe("matched");
    expect(bodyB.roomId).toBe(body.roomId);
  });

  it("returns waiting while no opponent has appeared", async () => {
    const ctx = createExecutionContext();
    const cookie = await makeSessionCookie("player-wait");

    const enqueueRes = await SELF.fetch("http://localhost/api/matchmake", {
      method: "POST",
      headers: { Cookie: cookie },
    });
    const { token } = (await enqueueRes.json()) as { status: string; token: string };

    const pollRes = await SELF.fetch(
      `http://localhost/api/matchmake/${token}`,
      { headers: { Cookie: cookie } }
    );
    await waitOnExecutionContext(ctx);

    const body = (await pollRes.json()) as { status: string };
    expect(body.status).toBe("waiting");
  });
});
