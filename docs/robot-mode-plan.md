# Plan: Play vs Robot Mode

## Context

Players currently can only match against other humans, which requires a live opponent. A robot mode lets players practice, learn, or play when no human opponent is available. The bot lives entirely inside the `GameRoom` Durable Object — no new DO, no new DB records, no external service.

---

## Approach

### Core idea
The GameRoom already owns all game state and timers. When a room is flagged as a bot match, the DO acts as both host *and* the bot player: it schedules a short alarm for the bot's turn, picks a valid word from D1, and submits it through the same internal path a real player uses.

The bot's fixed player ID is the string `"bot"`. It is added to the room's `playerIds` before the human connects, so when the human's WebSocket arrives the room already has 2 players and `startMatch()` fires immediately.

---

## Files to Modify

| File | What changes |
|------|-------------|
| `src/modules/D1Dictionary.ts` | Add `pickWord(startsWith, excluded)` method |
| `src/durable-objects/GameRoom.ts` | Bot scheduling, word submission, auto-confirm next round |
| `src/index.ts` | New `/api/rooms/vs-bot` route + `/add-bot` forwarding |
| `frontend/src/app/page.tsx` | "Play vs Bot" button |
| `frontend/src/app/game/page.tsx` | Label opponent as "Bot" when id === `"bot"` |

---

## Step-by-Step Changes

### 1. `src/modules/D1Dictionary.ts`

Add one method:

```typescript
async pickWord(startsWith: string, excluded: Set<string>): Promise<string | null> {
  const rows = await this.db
    .prepare("SELECT word FROM dictionary WHERE word LIKE ? LIMIT 100")
    .bind(startsWith.toLowerCase() + "%")
    .all<{ word: string }>();
  const candidates = (rows.results ?? []).map(r => r.word).filter(w => !excluded.has(w));
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
}
```

### 2. `src/durable-objects/GameRoom.ts`

**2a. RoomStorage** — add `botPlayerId?: string`

**2b. AlarmKind** — extend to `"turn" | "rematch" | "next_round" | "bot_turn"`

**2c. `/add-bot` endpoint** in `fetch()`:
```typescript
if (url.pathname === "/add-bot" && request.method === "POST") {
  const stored = await this.loadRoom();
  if (!stored.playerIds.includes("bot")) {
    stored.playerIds.push("bot");
    stored.scores["bot"] = 0;
    stored.botPlayerId = "bot";
  }
  await this.saveRoom(stored);
  return new Response(null, { status: 204 });
}
```

**2d. `startTimer` effect in `applyEffects()`** — when current player is the bot, set a short `bot_turn` alarm instead of the full turn timer:
```typescript
case "startTimer": {
  const round = stored.matchState?.currentRound;
  if (round?.currentPlayerId === stored.botPlayerId) {
    const delay = 800 + Math.floor(Math.random() * 1200); // 0.8–2s
    await this.setAlarm(stored, "bot_turn", Date.now() + delay);
    stored.turnStartAt = Date.now();
    break;
  }
  // ... existing player-turn timer logic unchanged ...
}
```

**2e. `alarm()` handler** — add `bot_turn` case before the existing turn-timeout block:
```typescript
if (kind === "bot_turn") {
  await this.handleBotTurn(stored);
  return;
}
```

**2f. `handleBotTurn()` method**:
```typescript
private async handleBotTurn(stored: RoomStorage): Promise<void> {
  if (!stored.matchState || stored.matchState.status !== "round_active") return;
  const round = stored.matchState.currentRound;
  if (!round || round.currentPlayerId !== stored.botPlayerId) return;

  const excluded = new Set(round.chain);
  const word = await this.dictionary.pickWord(round.seedLetter, excluded);

  if (!word) {
    // No valid word found — simulate turn timeout
    const result = transition(stored.matchState, {
      type: "turnTimeout",
      playerId: stored.botPlayerId!,
    });
    const prevRound = round.roundNumber;
    stored.matchState = result.state;
    this.saveRoundHistoryIfEnded(stored, prevRound);
    await this.saveRoom(stored);
    await this.applyEffects(result.effects, stored);
    await this.maybeAutoConfirmNextRound(stored);
    return;
  }

  await this.submitWordForBot(stored, word);
}
```

**2g. `submitWordForBot()` method** — mirrors `handleWordSubmission` but without a `ws` reference and without power-up constraint checks (v1 simplification):
```typescript
private async submitWordForBot(stored: RoomStorage, word: string): Promise<void> {
  const botId = stored.botPlayerId!;
  const state = stored.matchState!;
  const round = state.currentRound!;
  const usedWords = new Set(round.chain);

  const validation = await validate(word, round.seedLetter, usedWords, this.dictionary, {});
  if (!validation.valid) {
    // Shouldn't happen — word came from pickWord — but handle gracefully
    const result = transition(state, { type: "invalidWord", playerId: botId });
    stored.matchState = result.state;
    this.saveRoundHistoryIfEnded(stored, round.roundNumber);
    await this.saveRoom(stored);
    await this.applyEffects(result.effects, stored);
    await this.maybeAutoConfirmNextRound(stored);
    return;
  }

  const scoreResult = score(word, { multiplier: 1 });
  stored.currentRoundWords.push({ word, playerId: botId, points: scoreResult.points, breakdown: scoreResult.breakdown });

  const wordResult = transition(state, {
    type: "wordSubmitted",
    playerId: botId,
    word,
    points: scoreResult.points,
  });
  stored.matchState = wordResult.state;

  if (stored.matchState.currentRound) {
    stored.matchState.currentRound.seedLetter = word[word.length - 1] ?? round.seedLetter;
  }

  stored.scores[botId] = (stored.scores[botId] ?? 0) + scoreResult.points;
  await this.saveRoom(stored);
  await this.applyEffects(wordResult.effects, stored);
  await this.maybeAutoConfirmNextRound(stored);
}
```

**2h. `maybeAutoConfirmNextRound()` method**:
```typescript
private async maybeAutoConfirmNextRound(stored: RoomStorage): Promise<void> {
  const s = await this.loadRoom(); // reload after effects
  if (!s.botPlayerId || s.matchState?.status !== "round_complete") return;
  const ctx = s.matchState.roundEndContext;
  if (!ctx || ctx.nextRoundConfirmations.includes(s.botPlayerId)) return;
  await this.handleNextRoundRequest(s.botPlayerId);
}
```

### 3. `src/index.ts`

Add new route (before the catch-all):

```typescript
if (url.pathname === "/api/rooms/vs-bot" && request.method === "POST") {
  const auth = await authenticate(request, env);
  if (!auth) return new Response("Unauthorized", { status: 401 });
  
  let mode: GameMode = "classic";
  try {
    const body = (await request.json()) as { mode?: unknown };
    if (isValidGameMode(body.mode)) mode = body.mode;
  } catch {}

  const slug = generateRoomSlug();
  const id = env.GAME_ROOM.idFromName(slug);
  const stub = env.GAME_ROOM.get(id);
  const base = new URL(request.url);

  // Init room with mode
  const initUrl = new URL(base); initUrl.pathname = "/init";
  await stub.fetch(new Request(initUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  }));

  // Pre-register bot player
  const addBotUrl = new URL(base); addBotUrl.pathname = "/add-bot";
  await stub.fetch(new Request(addBotUrl, { method: "POST" }));

  return Response.json({ roomId: slug }, { status: 201 });
}
```

Also import `isValidGameMode` and `type GameMode` from `gameModes`.

### 4. `frontend/src/app/page.tsx`

Add a `handlePlayVsBot()` handler:

```typescript
async function handlePlayVsBot() {
  const res = await fetch('/api/rooms/vs-bot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  })
  const body = (await res.json()) as { roomId?: string }
  if (body.roomId) router.push(`/game/?room=${body.roomId}`)
}
```

Add a "vs Bot" button alongside the existing Play/Challenge buttons. Visually secondary to the real matchmaking button — a small "Practice vs Bot" link/button below the main play section.

### 5. `frontend/src/app/game/page.tsx`

Where the opponent's display name is shown, check if `opponentId === "bot"` and render "Bot" as the display name instead of fetching from API. The simplest approach: when the player info fetch returns no name for `"bot"`, fall back to `"Bot"`.

The current game page uses `myId` to determine which player is "me". The opponent name is likely derived from the match state player IDs. Check how avatar/name is currently rendered and add a `"bot"` → `"Bot"` display mapping.

---

## Edge Cases

- **Bot power-ups**: Bot earns power-ups from drops but never uses them. This is fine for v1.
- **Match complete**: When match ends in bot mode, `persistMatch` will write a record with `player2Id = "bot"`. This might show an odd opponent name in recent matches. Options: (a) skip persistence for bot matches, (b) filter bot games from recent matches. Plan: skip ELO update for bot matches — add a guard in `MatchPersistence.ts` or in `applyEffects` `matchOver` case. The match record can still be written but ELO shouldn't change.
- **Next round confirm timeout**: Bot auto-confirms immediately via `maybeAutoConfirmNextRound`, so the 30s `next_round` alarm should rarely (never) fire for bot games. Safe to leave as-is.
- **Rematch in bot mode**: Disable the rematch button on the frontend when opponent is `"bot"` — user goes back to lobby instead.
- **Bot ELO**: Bot has no DB record. `persistMatch` inserts player stats — guard against writing ELO for `player_id = "bot"` in the DB upsert, or handle the missing row gracefully (it likely already fails silently).

---

## Verification

1. `npm run type-check` (root) — confirm no type errors in backend
2. `npm test` — existing tests must still pass
3. Start `npm run dev` (root) + `npm run dev` (frontend/)
4. Click "Play vs Bot" → room created immediately → game starts → bot submits words on its turns
5. Play through a full match (bot wins rounds, human wins rounds, match completes)
6. Verify recent matches page doesn't crash when bot match appears
7. `npm run type-check` (frontend/) — confirm game page changes compile
