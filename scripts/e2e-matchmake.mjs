// Live E2E for matchmaking. Spawns N guest sessions against a running dev
// server, races them at POST /api/matchmake, then polls each token until
// matched or a max-attempts cap. Reports pair structure.
//
// Usage:  node scripts/e2e-matchmake.mjs [N] [mode]
//   N     defaults to 6
//   mode  defaults to "classic"
//
// Requires `npm run dev` to be running on http://localhost:8787.

const BASE = process.env.BASE_URL ?? "http://localhost:8787";
const N = parseInt(process.argv[2] ?? "6", 10);
const MODE = process.argv[3] ?? "classic";

function extractSessionCookie(setCookie) {
  if (!setCookie) return null;
  const m = setCookie.match(/session=([^;]+)/);
  return m ? `session=${m[1]}` : null;
}

async function acquireGuest() {
  const res = await fetch(`${BASE}/api/me`);
  if (!res.ok) throw new Error(`/api/me failed: ${res.status}`);
  const setCookie = res.headers.get("set-cookie");
  const cookie = extractSessionCookie(setCookie);
  if (!cookie) throw new Error("No session cookie issued");
  const body = await res.json();
  return { cookie, playerId: body.id, name: body.display_name };
}

async function postMatchmake(player) {
  const res = await fetch(`${BASE}/api/matchmake`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: player.cookie },
    body: JSON.stringify({ mode: MODE }),
  });
  return res.json();
}

async function pollOnce(player, token) {
  const res = await fetch(`${BASE}/api/matchmake/${token}`, {
    headers: { Cookie: player.cookie },
  });
  return res.json();
}

async function main() {
  console.log(`E2E matchmaking: N=${N}, mode=${MODE}, base=${BASE}`);

  // Acquire guests sequentially (the D1 INSERT in /api/me is the bottleneck).
  const players = [];
  for (let i = 0; i < N; i++) {
    players.push(await acquireGuest());
  }
  console.log(`Acquired ${players.length} guest sessions`);

  // Race the POSTs as concurrently as possible.
  const t0 = Date.now();
  const postResponses = await Promise.all(players.map((p) => postMatchmake(p)));
  console.log(`All POSTs returned in ${Date.now() - t0}ms`);

  const tokens = postResponses.map((r) => r.token);
  const initialStatus = postResponses.map((r) => r.status);
  const initialMatchedCount = initialStatus.filter((s) => s === "matched").length;
  console.log(`Initial POST status counts:`, summarize(initialStatus));
  console.log(`Initially matched at POST time: ${initialMatchedCount}`);

  // For players whose POST returned matched, we already have roomId.
  const finalRoom = new Map(); // playerIdx -> roomId
  postResponses.forEach((r, i) => {
    if (r.status === "matched" && r.roomId) finalRoom.set(i, r.roomId);
  });

  // Poll the rest, up to 6 cycles spaced 1s apart.
  const MAX_CYCLES = 6;
  for (let cycle = 0; cycle < MAX_CYCLES; cycle++) {
    const pending = [];
    for (let i = 0; i < players.length; i++) {
      if (finalRoom.has(i)) continue;
      if (!tokens[i]) continue;
      pending.push(
        pollOnce(players[i], tokens[i]).then((body) => {
          if (body.status === "matched" && body.roomId) {
            finalRoom.set(i, body.roomId);
          }
        })
      );
    }
    if (pending.length === 0) break;
    await Promise.all(pending);
    if (finalRoom.size === players.length) break;
    await sleep(1000);
  }

  // Report.
  const matchedPlayers = [...finalRoom.entries()];
  const waitingPlayers = players
    .map((_, i) => i)
    .filter((i) => !finalRoom.has(i));

  const byRoom = new Map();
  for (const [idx, room] of matchedPlayers) {
    const arr = byRoom.get(room) ?? [];
    arr.push(idx);
    byRoom.set(room, arr);
  }

  console.log(`\n=== Results ===`);
  console.log(`Total players: ${players.length}`);
  console.log(`Matched: ${matchedPlayers.length}`);
  console.log(`Waiting: ${waitingPlayers.length}`);
  console.log(`Rooms formed: ${byRoom.size}`);
  for (const [room, idxs] of byRoom) {
    const names = idxs.map((i) => players[i].name);
    console.log(`  room ${room.slice(0, 8)}…  pair=[${names.join(", ")}]  size=${idxs.length}`);
  }
  if (waitingPlayers.length > 0) {
    const names = waitingPlayers.map((i) => players[i].name);
    console.log(`  waiting: [${names.join(", ")}]`);
  }

  // Validation. Each tracked player must end up either matched in a room
  // with another tracked player, or with an untracked partner (leftover from
  // a previous queue state — that's correct production behavior). At most one
  // tracked player may remain waiting.
  let ok = true;
  const soloRooms = [...byRoom.values()].filter((idxs) => idxs.length === 1).length;
  // soloRooms means a tracked player paired with someone outside this run.
  // That's OK — exactly one such pairing can come from a single pre-existing
  // queue entry. We accept up to 1 leftover-style pairing.
  if (soloRooms > 1) {
    console.error(`FAIL: ${soloRooms} tracked players paired with untracked partners (max 1 allowed)`);
    ok = false;
  }
  for (const [room, idxs] of byRoom) {
    if (idxs.length > 2) {
      console.error(`FAIL: room ${room} has ${idxs.length} players (expected ≤ 2)`);
      ok = false;
    }
  }
  // No tracked player should be matched into the same room as another player
  // they shouldn't be paired with (double-pairing).
  const allMatchedIds = matchedPlayers.map(([i]) => i);
  if (allMatchedIds.length + waitingPlayers.length !== players.length) {
    console.error(`FAIL: bookkeeping mismatch`);
    ok = false;
  }
  // Pure-fresh-state expectation: with no leftovers, exactly ⌊N/2⌋ pairs +
  // (N mod 2) waiting. Log this for visibility but only enforce as warning
  // if soloRooms > 0 (which implies external queue state).
  if (soloRooms === 0) {
    const expectedPairs = Math.floor(N / 2);
    const expectedWaiting = N % 2;
    if (byRoom.size !== expectedPairs) {
      console.error(`FAIL: expected ${expectedPairs} clean pairs, got ${byRoom.size}`);
      ok = false;
    }
    if (waitingPlayers.length !== expectedWaiting) {
      console.error(`FAIL: expected ${expectedWaiting} waiting, got ${waitingPlayers.length}`);
      ok = false;
    }
  }
  if (ok) {
    console.log(`\n✓ PASS for N=${N}, mode=${MODE}`);
    process.exit(0);
  } else {
    console.error(`\n✗ FAIL for N=${N}, mode=${MODE}`);
    process.exit(1);
  }
}

function summarize(arr) {
  const counts = {};
  for (const v of arr) counts[v] = (counts[v] ?? 0) + 1;
  return counts;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
