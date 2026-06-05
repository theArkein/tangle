import { describe, it, expect } from "vitest";
import { createExecutionContext, waitOnExecutionContext, SELF } from "cloudflare:test";

const TEST_JWT_SECRET = "test-jwt-secret-32-bytes-padding!!";

async function makeSessionCookie(playerId: string): Promise<string> {
  const { signJwt } = await import("../../src/auth/jwt");
  const now = Math.floor(Date.now() / 1000);
  const token = await signJwt({ sub: playerId, exp: now + 3600 }, TEST_JWT_SECRET);
  return `session=${token}`;
}

async function createRoom(): Promise<string> {
  const res = await SELF.fetch("http://localhost/api/rooms", { method: "POST" });
  const { roomId } = (await res.json()) as { roomId: string };
  return roomId;
}

describe("POST /api/rooms (invite link source)", () => {
  it("initializes the room so it can be found via GET", async () => {
    const ctx = createExecutionContext();
    const roomId = await createRoom();

    const res = await SELF.fetch(`http://localhost/api/rooms/${roomId}`);
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; players: string[] };
    expect(body.status).toBe("waiting");
    expect(body.players).toEqual([]);
  });
});

describe("GET /api/rooms/:id", () => {
  it("returns 404 for a room ID that was never created", async () => {
    const ctx = createExecutionContext();
    const res = await SELF.fetch("http://localhost/api/rooms/nonexistentroom00");
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("room_not_found");
  });
});

describe("GET /api/rooms/:id/join", () => {
  it("returns 401 without a session cookie", async () => {
    const ctx = createExecutionContext();
    const roomId = await createRoom();

    const res = await SELF.fetch(`http://localhost/api/rooms/${roomId}/join`);
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(401);
  });

  it("returns 404 for a room ID that was never created", async () => {
    const ctx = createExecutionContext();
    const cookie = await makeSessionCookie("player-join-1");

    const res = await SELF.fetch(
      "http://localhost/api/rooms/nonexistentroom01/join",
      { headers: { Cookie: cookie } }
    );
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("room_not_found");
  });

  it("returns join info for a valid, open room", async () => {
    const ctx = createExecutionContext();
    const cookie = await makeSessionCookie("player-join-2");
    const roomId = await createRoom();

    const res = await SELF.fetch(
      `http://localhost/api/rooms/${roomId}/join`,
      { headers: { Cookie: cookie } }
    );
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      playersConnected: number;
    };
    expect(body.status).toBe("waiting");
    expect(body.playersConnected).toBe(0);
  });
});
