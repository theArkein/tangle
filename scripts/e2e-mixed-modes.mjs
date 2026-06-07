// Verify mode isolation under concurrency: M classic + M speed players all
// POST at the same time. Each should pair only within its own mode.

const BASE = process.env.BASE_URL ?? "http://localhost:8787";
const M = parseInt(process.argv[2] ?? "6", 10);

function extractSessionCookie(setCookie) {
  const m = setCookie?.match(/session=([^;]+)/);
  return m ? `session=${m[1]}` : null;
}

async function acquireGuest() {
  const res = await fetch(`${BASE}/api/me`);
  const cookie = extractSessionCookie(res.headers.get("set-cookie"));
  const body = await res.json();
  return { cookie, playerId: body.id, name: body.display_name };
}

async function postMatchmake(player, mode) {
  const res = await fetch(`${BASE}/api/matchmake`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: player.cookie },
    body: JSON.stringify({ mode }),
  });
  return res.json();
}

async function pollOnce(player, token) {
  const res = await fetch(`${BASE}/api/matchmake/${token}`, { headers: { Cookie: player.cookie } });
  return res.json();
}

async function main() {
  console.log(`Mixed-mode E2E: ${M} classic + ${M} speed players concurrent`);
  const classic = [];
  const speed = [];
  for (let i = 0; i < M; i++) classic.push(await acquireGuest());
  for (let i = 0; i < M; i++) speed.push(await acquireGuest());

  const t0 = Date.now();
  const all = [
    ...classic.map((p) => postMatchmake(p, "classic").then((r) => ({ ...r, mode: "classic", player: p }))),
    ...speed.map((p) => postMatchmake(p, "speed_round").then((r) => ({ ...r, mode: "speed_round", player: p }))),
  ];
  // Shuffle the order in which we await — Promise.all races them all.
  const results = await Promise.all(all);
  console.log(`All ${results.length} POSTs in ${Date.now() - t0}ms`);

  const byMode = { classic: [], speed_round: [] };
  for (const r of results) byMode[r.mode].push(r);

  // Resolve pendings.
  for (const r of results) {
    if (r.status === "pending") {
      for (let i = 0; i < 6; i++) {
        const poll = await pollOnce(r.player, r.token);
        if (poll.status === "matched") {
          r.status = "matched";
          r.roomId = poll.roomId;
          break;
        }
        await new Promise((res) => setTimeout(res, 500));
      }
    }
  }

  // Now group by roomId, check no cross-mode pairing.
  const roomMode = new Map(); // roomId -> mode
  let ok = true;
  for (const r of results) {
    if (!r.roomId) continue;
    if (roomMode.has(r.roomId) && roomMode.get(r.roomId) !== r.mode) {
      console.error(`FAIL: room ${r.roomId} contains both ${roomMode.get(r.roomId)} and ${r.mode} players`);
      ok = false;
    }
    roomMode.set(r.roomId, r.mode);
  }

  const classicRooms = new Set(byMode.classic.filter((r) => r.roomId).map((r) => r.roomId));
  const speedRooms = new Set(byMode.speed_round.filter((r) => r.roomId).map((r) => r.roomId));
  for (const r of classicRooms) {
    if (speedRooms.has(r)) {
      console.error(`FAIL: roomId ${r} appears in both classic and speed rooms`);
      ok = false;
    }
  }

  console.log(`Classic rooms: ${classicRooms.size}, Speed rooms: ${speedRooms.size}`);
  console.log(`Classic matched: ${byMode.classic.filter((r) => r.status === "matched").length}/${M}`);
  console.log(`Speed   matched: ${byMode.speed_round.filter((r) => r.status === "matched").length}/${M}`);

  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
