import { describe, it, expect } from "vitest";
import { SELF, env } from "cloudflare:test";
import type { Env } from "../../src/index";
import { signJwt } from "../../src/auth/jwt";

const typedEnv = env as unknown as Env;
const TEST_JWT_SECRET = "test-jwt-secret-32-bytes-padding!!";

async function makeSessionCookie(playerId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const token = await signJwt({ sub: playerId, exp: now + 3600 }, TEST_JWT_SECRET);
  return `session=${token}`;
}

describe("GET /api/auth/google", () => {
  it("returns 401 without a session cookie", async () => {
    const res = await SELF.fetch("http://localhost/api/auth/google", {
      redirect: "manual",
    });
    expect(res.status).toBe(401);
  });

  it("redirects to Google with correct params when authenticated", async () => {
    const cookie = await makeSessionCookie("oauth-p1");
    const res = await SELF.fetch("http://localhost/api/auth/google", {
      headers: { Cookie: cookie },
      redirect: "manual",
    });

    expect(res.status).toBe(302);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("accounts.google.com/o/oauth2/v2/auth");
    expect(location).toContain("response_type=code");
    expect(location).toContain("scope=openid");
    expect(location).toContain("state=");
    // state is stored in KV
    const stateMatch = location.match(/state=([a-f0-9]+)/);
    expect(stateMatch).not.toBeNull();
    const storedPlayerId = await typedEnv.KV.get(`oauth_state:${stateMatch![1]}`);
    expect(storedPlayerId).toBe("oauth-p1");
  });
});

describe("GET /api/auth/google/callback", () => {
  it("redirects to error when 'error' param is present", async () => {
    const res = await SELF.fetch(
      "http://localhost/api/auth/google/callback?error=access_denied",
      { redirect: "manual" }
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("oauth_error=cancelled");
  });

  it("redirects to error when state is missing or unknown", async () => {
    const res = await SELF.fetch(
      "http://localhost/api/auth/google/callback?code=abc&state=unknownstate",
      { redirect: "manual" }
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("oauth_error=invalid_state");
  });

  it("consumes the state token after use", async () => {
    const state = "teststate123abc";
    await typedEnv.KV.put(`oauth_state:${state}`, "player-state-test");

    // First call consumes the state (will fail at token exchange but that's ok)
    await SELF.fetch(
      `http://localhost/api/auth/google/callback?code=fakecode&state=${state}`,
      { redirect: "manual" }
    );

    // Second call with the same state should fail with invalid_state
    const res2 = await SELF.fetch(
      `http://localhost/api/auth/google/callback?code=fakecode&state=${state}`,
      { redirect: "manual" }
    );
    expect(res2.headers.get("location")).toContain("oauth_error=invalid_state");
  });
});
