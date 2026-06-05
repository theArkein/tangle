import { describe, it, expect } from "vitest";
import { signJwt, verifyJwt } from "../../src/auth/jwt";

const SECRET = "test-secret-key";

describe("JWT utilities", () => {
  it("signs and verifies a valid JWT, returning original payload", async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = { sub: "player-123", exp: now + 3600, custom: "value" };

    const token = await signJwt(payload, SECRET);
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3);

    const result = await verifyJwt(token, SECRET);
    expect(result).not.toBeNull();
    expect(result?.["sub"]).toBe("player-123");
    expect(result?.["custom"]).toBe("value");
    expect(result?.["exp"]).toBe(payload.exp);
  });

  it("returns null when verified with the wrong secret", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signJwt({ sub: "player-456", exp: now + 3600 }, SECRET);

    const result = await verifyJwt(token, "wrong-secret");
    expect(result).toBeNull();
  });

  it("returns null for an expired JWT", async () => {
    const pastExp = Math.floor(Date.now() / 1000) - 1;
    const token = await signJwt({ sub: "player-789", exp: pastExp }, SECRET);

    const result = await verifyJwt(token, SECRET);
    expect(result).toBeNull();
  });
});
