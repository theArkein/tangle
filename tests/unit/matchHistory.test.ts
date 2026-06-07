import { describe, it, expect, beforeAll } from "vitest";
import { SELF, env } from "cloudflare:test";
import { persistMatch } from "../../src/modules/MatchPersistence";
import type { Env } from "../../src/index";
import { signJwt } from "../../src/auth/jwt";

// cloudflare:test's `env` is ProvidedEnv — cast to our Env so we can call
// persistMatch directly without spinning up the full Worker.
const typedEnv = env as unknown as Env;

beforeAll(async () => {
  await typedEnv.DB.exec(
    "CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, display_name TEXT NOT NULL, elo INTEGER NOT NULL DEFAULT 1000, created_at INTEGER NOT NULL, linked_oauth_provider TEXT, xp INTEGER NOT NULL DEFAULT 0, total_wins INTEGER NOT NULL DEFAULT 0, title TEXT NOT NULL DEFAULT 'Apprentice')"
  );
  await typedEnv.DB.exec(
    "CREATE TABLE IF NOT EXISTS matches (id TEXT PRIMARY KEY, player1_id TEXT NOT NULL, player2_id TEXT NOT NULL, winner_id TEXT, round_scores TEXT NOT NULL, created_at INTEGER NOT NULL)"
  );
  await typedEnv.DB.exec(
    "CREATE TABLE IF NOT EXISTS match_words (id TEXT PRIMARY KEY, match_id TEXT NOT NULL, round_number INTEGER NOT NULL, turn_order INTEGER NOT NULL, word TEXT NOT NULL, player_id TEXT NOT NULL, points INTEGER NOT NULL)"
  );
});

const TEST_JWT_SECRET = "test-jwt-secret-32-bytes-padding!!";

async function makeSessionCookie(playerId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const token = await signJwt({ sub: playerId, exp: now + 3600 }, TEST_JWT_SECRET);
  return `session=${token}`;
}

async function seedPlayer(id: string, displayName: string, elo = 1000): Promise<void> {
  await typedEnv.DB.prepare(
    "INSERT INTO players (id, display_name, elo, created_at) VALUES (?, ?, ?, ?)"
  )
    .bind(id, displayName, elo, Date.now())
    .run();
}

describe("persistMatch", () => {
  it("writes a match row, match_words rows, and updates ELO", async () => {
    await seedPlayer("pm-p1", "Alice");
    await seedPlayer("pm-p2", "Bob");

    await persistMatch(typedEnv, {
      player1Id: "pm-p1",
      player2Id: "pm-p2",
      winnerId: "pm-p1",
      roundWins: { "pm-p1": 3, "pm-p2": 1 },
      roundHistory: [
        {
          roundNumber: 1,
          winnerId: "pm-p1",
          words: [
            { word: "apple", playerId: "pm-p1", points: 5, breakdown: { base: 5, rareLetter: 0, longWord: 0 } },
            { word: "eat",   playerId: "pm-p2", points: 3, breakdown: { base: 3, rareLetter: 0, longWord: 0 } },
          ],
        },
      ],
    });

    // Match row exists with correct winner and round_scores
    const match = await typedEnv.DB.prepare(
      "SELECT winner_id, round_scores FROM matches WHERE player1_id = ? AND player2_id = ?"
    )
      .bind("pm-p1", "pm-p2")
      .first<{ winner_id: string; round_scores: string }>();
    expect(match?.winner_id).toBe("pm-p1");
    expect(JSON.parse(match?.round_scores ?? "{}")).toEqual({ "pm-p1": 3, "pm-p2": 1 });

    // Two match_words rows persisted
    const words = await typedEnv.DB.prepare(
      `SELECT COUNT(*) AS count FROM match_words
       WHERE match_id = (SELECT id FROM matches WHERE player1_id = ? AND player2_id = ?)`
    )
      .bind("pm-p1", "pm-p2")
      .first<{ count: number }>();
    expect(words?.count).toBe(2);

    // ELO: winner gained, loser lost; zero-sum
    const p1 = await typedEnv.DB.prepare("SELECT elo FROM players WHERE id = ?").bind("pm-p1").first<{ elo: number }>();
    const p2 = await typedEnv.DB.prepare("SELECT elo FROM players WHERE id = ?").bind("pm-p2").first<{ elo: number }>();
    expect((p1?.elo ?? 1000) > 1000).toBe(true);
    expect((p2?.elo ?? 1000) < 1000).toBe(true);
    expect((p1?.elo ?? 0) + (p2?.elo ?? 0)).toBe(2000);
  });

  it("awards a larger ELO swing for an upset", async () => {
    await seedPlayer("pm-strong", "Strong", 1400);
    await seedPlayer("pm-weak",   "Weak",   600);

    await persistMatch(typedEnv, {
      player1Id: "pm-strong",
      player2Id: "pm-weak",
      winnerId: "pm-weak",
      roundWins: { "pm-strong": 1, "pm-weak": 3 },
      roundHistory: [],
    });

    const strong = await typedEnv.DB.prepare("SELECT elo FROM players WHERE id = ?").bind("pm-strong").first<{ elo: number }>();
    const weak   = await typedEnv.DB.prepare("SELECT elo FROM players WHERE id = ?").bind("pm-weak").first<{ elo: number }>();
    // Upset — weak gains more than the standard 16
    expect((weak?.elo ?? 600) - 600).toBeGreaterThan(20);
    expect(1400 - (strong?.elo ?? 1400)).toBeGreaterThan(20);
  });

  it("trims match history to 50 records per player", async () => {
    await seedPlayer("pm-trim1", "Trim1");
    await seedPlayer("pm-trim2", "Trim2");

    for (let i = 0; i < 51; i++) {
      await persistMatch(typedEnv, {
        player1Id: "pm-trim1",
        player2Id: "pm-trim2",
        winnerId: "pm-trim1",
        roundWins: { "pm-trim1": 3, "pm-trim2": 0 },
        roundHistory: [],
      });
    }

    const count = await typedEnv.DB.prepare(
      "SELECT COUNT(*) AS count FROM matches WHERE player1_id = ? OR player2_id = ?"
    )
      .bind("pm-trim1", "pm-trim1")
      .first<{ count: number }>();
    expect(count?.count).toBe(50);
  });
});

describe("GET /api/me/matches", () => {
  it("returns 401 without a session cookie", async () => {
    const res = await SELF.fetch("http://localhost/api/me/matches");
    expect(res.status).toBe(401);
  });

  it("returns an empty array when the player has no matches", async () => {
    await seedPlayer("gm-nomatches", "NoMatches");
    const cookie = await makeSessionCookie("gm-nomatches");

    const res = await SELF.fetch("http://localhost/api/me/matches", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns the 10 most recent matches with the correct shape", async () => {
    await seedPlayer("gm-p1", "P1Player");
    await seedPlayer("gm-p2", "P2Player");

    for (let i = 0; i < 12; i++) {
      await persistMatch(typedEnv, {
        player1Id: "gm-p1",
        player2Id: "gm-p2",
        winnerId: i % 2 === 0 ? "gm-p1" : "gm-p2",
        roundWins: {
          "gm-p1": i % 2 === 0 ? 3 : 1,
          "gm-p2": i % 2 === 0 ? 1 : 3,
        },
        roundHistory: [],
      });
    }

    const cookie = await makeSessionCookie("gm-p1");
    const res = await SELF.fetch("http://localhost/api/me/matches", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      id: string;
      opponent: string;
      outcome: string;
      roundScores: [number, number];
      date: number;
    }[];

    expect(body.length).toBe(10);
    expect(body[0]!.opponent).toBe("P2Player");
    expect(["win", "loss"]).toContain(body[0]!.outcome);
    expect(body[0]!.roundScores).toHaveLength(2);
    expect(typeof body[0]!.date).toBe("number");
    // Most recent first
    expect(body[0]!.date).toBeGreaterThanOrEqual(body[1]!.date);
  });
});
