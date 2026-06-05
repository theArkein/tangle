import { describe, it, expect, vi } from "vitest";
import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
  SELF,
} from "cloudflare:test";

const TEST_JWT_SECRET = "test-jwt-secret-32-bytes-padding!!";

// Helper: sign a minimal JWT for test players
async function makeSessionCookie(playerId: string): Promise<string> {
  const { signJwt } = await import("../../src/auth/jwt");
  const now = Math.floor(Date.now() / 1000);
  const token = await signJwt({ sub: playerId, exp: now + 3600 }, TEST_JWT_SECRET);
  return `session=${token}`;
}

describe("POST /api/rooms", () => {
  it("returns a 16-character room ID", async () => {
    const ctx = createExecutionContext();
    const res = await SELF.fetch("http://localhost/api/rooms", {
      method: "POST",
    });
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(201);
    const body = (await res.json()) as { roomId: string };
    expect(typeof body.roomId).toBe("string");
    expect(body.roomId.length).toBe(16);
  });

  it("returns unique IDs on each call", async () => {
    const ctx = createExecutionContext();
    const [r1, r2] = await Promise.all([
      SELF.fetch("http://localhost/api/rooms", { method: "POST" }),
      SELF.fetch("http://localhost/api/rooms", { method: "POST" }),
    ]);
    await waitOnExecutionContext(ctx);

    const { roomId: id1 } = (await r1.json()) as { roomId: string };
    const { roomId: id2 } = (await r2.json()) as { roomId: string };
    expect(id1).not.toBe(id2);
  });
});

describe("GET /api/rooms/:id", () => {
  it("returns room info for a new room", async () => {
    const ctx = createExecutionContext();
    const postRes = await SELF.fetch("http://localhost/api/rooms", {
      method: "POST",
    });
    const { roomId } = (await postRes.json()) as { roomId: string };

    const getRes = await SELF.fetch(`http://localhost/api/rooms/${roomId}`);
    await waitOnExecutionContext(ctx);

    expect(getRes.status).toBe(200);
    const body = (await getRes.json()) as { status: string; players: string[] };
    expect(body.status).toBe("waiting");
    expect(body.players).toEqual([]);
  });
});

describe("WebSocket /api/rooms/:id/ws", () => {
  it("rejects without a session cookie (401)", async () => {
    const ctx = createExecutionContext();
    const postRes = await SELF.fetch("http://localhost/api/rooms", {
      method: "POST",
    });
    const { roomId } = (await postRes.json()) as { roomId: string };

    const wsRes = await SELF.fetch(
      `http://localhost/api/rooms/${roomId}/ws`,
      {
        headers: { Upgrade: "websocket", Connection: "Upgrade" },
      }
    );
    await waitOnExecutionContext(ctx);

    expect(wsRes.status).toBe(401);
  });

  it("rejects non-WebSocket requests with 426", async () => {
    const ctx = createExecutionContext();
    const postRes = await SELF.fetch("http://localhost/api/rooms", {
      method: "POST",
    });
    const { roomId } = (await postRes.json()) as { roomId: string };
    const cookie = await makeSessionCookie("player-1");

    const res = await SELF.fetch(`http://localhost/api/rooms/${roomId}/ws`, {
      headers: { Cookie: cookie },
    });
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(426);
  });
});
