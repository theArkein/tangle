# Tangle — Gameplay Redesign Implementation Prompt

## Overview

Implement a full gameplay redesign for the Tangle word chain game. All decisions are documented in `docs/gameplay-redesign-decisions.md` — refer to it throughout. This touches backend (Cloudflare Workers + Durable Objects) and frontend (Next.js static export). Every change must be reflected in both layers.

After completing all changes, run `npm run type-check` in both the root and `frontend/` directories. All TypeScript errors must be resolved before finishing.

---

## 1. Power-Up System — Full Replacement

### Remove these power-ups entirely
Delete their definition files and remove all references across the entire codebase:
- `freeze.ts` → replaced by new version (see below)
- `peek.ts`
- `swap.ts`
- `steal.ts`
- `blitz.ts`
- `rush.ts`

Search for every reference to their IDs (`"freeze"`, `"peek"`, `"swap"`, `"steal"`, `"blitz"`, `"rush"`) in:
- `src/modules/powerups/types.ts`
- `src/modules/powerups/index.ts`
- `src/modules/PowerUpEngine.ts`
- `src/durable-objects/GameRoom.ts`
- `src/modules/MatchStateMachine.ts`
- `frontend/src/lib/powerups.ts`
- `frontend/src/app/game/page.tsx`

Remove all associated ActiveEffect types, helper functions, handlers, and UI references (swap letter picker, typing relay for peek, blitz turn override, etc.).

### Final power-up set (7 total)

| ID | Name | Emoji | What it does | Category |
|---|---|---|---|---|
| `secondLife` | Second Life | 💚 | Resets turn timer to 25s — auto on timeout or manually activated anytime | defensive |
| `letterBomb` | Letter Bomb | 💣 | Force opponent's next word to contain Q, X, Z, or J | offensive |
| `double` | Double | 🎯 | Player's next 3 words score 2× (not active during Danger Zone) | offensive |
| `wild` | Wild | 🃏 | Player's next word can start with any letter (ignores chain rule) | disruption |
| `anchor` | Anchor | ⚓ | Opponent's next word must be 6+ letters | offensive |
| `tax` | Tax | 💸 | Reduce opponent's current round score by 10 (floor at 0) | offensive |
| `freeze` | Freeze | ❄️ | Add 5 seconds to YOUR OWN turn timer (not opponent's) | defensive |

### Types to add to ActiveEffect union
```ts
| { kind: "doubleScore"; forPlayerId: PlayerId; wordsRemaining: number }
| { kind: "wildPending"; forPlayerId: PlayerId }
| { kind: "anchor"; onPlayerId: PlayerId; minLength: number }
```

Remove from ActiveEffect union: `freeze`, `swapPending`, `peek`, `blitzClaimed`

### Update emptyInventory()
```ts
{ secondLife: 0, letterBomb: 0, double: 0, wild: 0, anchor: 0, tax: 0, freeze: 0 }
```

### PowerUpEngine — activation logic

**freeze:** Instant, no persistent ActiveEffect. In GameRoom.handleUsePowerUp:
- Extend current alarm by 5000ms
- Shift `stored.turnStartAt += 5000` so client timer reflects the extra time
- Broadcast `power_up_activated` then `broadcastState`

**secondLife:** On manual activation by player: reset turn timer to 25000ms (setAlarm to Date.now() + 25000), set `stored.turnStartAt = Date.now()`. Also auto-activates on timeout (existing alarm handler) with same reset behavior.

**letterBomb:** Existing logic — keep as-is.

**double:** ActiveEffect `{ kind: "doubleScore"; forPlayerId; wordsRemaining: 3 }`. In handleWordSubmission: if doubleScore effect exists for current player AND not in DZ, apply 2× multiplier. Decrement wordsRemaining. Remove effect when wordsRemaining reaches 0.

**wild:** ActiveEffect `{ kind: "wildPending"; forPlayerId }`. In handleWordSubmission: if wildPending exists for current player, skip the chain letter validation entirely. Consume after one use.

**anchor:** ActiveEffect `{ kind: "anchor"; onPlayerId; minLength: 6 }`. In WordValidator: if anchor effect exists for submitting player, reject word if `word.length < 6`. Consume after one use.

**tax:** Instant. In GameRoom.handleUsePowerUp:
- Deduct 10 from `stored.matchState.currentRound.playerRoundScores[opponentId]` (floor at 0)
- Deduct 10 from `stored.scores[opponentId]` (floor at 0)
- Broadcast `power_up_activated` + `broadcastState`

---

## 2. Power-Up Earning Triggers — Deterministic System

Remove all existing pool-based drop logic (`pickFromCategory`, `TRIGGER_CATEGORY`, `SCORE_THRESHOLD_POINTS`, `CHAIN_LENGTH_THRESHOLD`). Replace with deterministic evaluation after each valid word submission.

### Trigger → Power-up mapping

| Condition | Awards | Notes |
|---|---|---|
| Player's cumulative score crosses a 25pt multiple | ❄️ Freeze | e.g. at 25, 50, 75, 100... (unlimited) |
| Word is 10+ letters | 🎯 Double | Any time |
| Word contains Q, X, Z, or J | 💣 Letter Bomb | Any time |
| Word is 8+ letters | ⚓ Anchor | Any time |
| Word played during Danger Zone | 💸 Tax | Any time in DZ |
| Player's word count this round is a multiple of 6 | 🃏 Wild | e.g. 6th, 12th, 18th word by that player |
| Word scores 15+ points | 💚 Second Life | Path 1 |
| Word contains 4+ distinct vowels (a,e,i,o,u) | 💚 Second Life | Path 2 |
| Word contains letters from 2+ different rare tiers | 💚 Second Life | Path 3 |

Track per-player word count in round state: `playerWordCounts: Record<PlayerId, number>`.

Evaluate all triggers after each valid word. Multiple triggers can fire in one turn.

### Rare letter tier helper (needed for Second Life path 3 and Scoring)
```
Tier 1 (Top):   Q, X, Z, J  → +3 pts each
Tier 2 (Mid):   V, K, W     → +2 pts each
Tier 3 (Low):   F, H, Y, B  → +1 pt each
```
A word "contains letters from 2+ rare tiers" means it has at least one letter from Tier 1 AND at least one from Tier 2 or 3, OR at least one from Tier 2 AND one from Tier 3.

---

## 3. Scoring Engine — Rare Letter Tiers

Update `src/modules/ScoringEngine.ts`:

```
Base:             1 point per letter
Rare letter:      +3 per Tier 1 letter (Q, X, Z, J)
                  +2 per Tier 2 letter (V, K, W)
                  +1 per Tier 3 letter (F, H, Y, B)
Long word bonus:  +5 if word is 8+ letters
Multiplier:       Danger Zone = 2× | doubleScore active = 2× | default = 1×
                  (DZ takes precedence over doubleScore — they do not stack)
```

Update `ScoreBreakdown` type to reflect tiered rare letter bonuses.

---

## 4. Round Win Condition — 59-Point Gap

Replace fault-based round end logic with score-gap check.

In `GameRoom.handleWordSubmission`, after updating scores:
```ts
const gap = (playerRoundScore) - (opponentRoundScore)
if (gap >= 59) {
  // trigger round end, current player wins
}
```

Remove `faultsToLoseRound` logic from `MatchStateMachine`. Faults no longer end a round.

**Fault penalty (keep faults but change effect):** Each invalid word deducts 2 seconds from the current turn alarm (`newAlarm = currentAlarm - 2000`, minimum 1000ms). No fault count tracking needed for round end.

---

## 5. Game Modes — Rename and Update Timers

Update `src/modules/gameModes.ts` and `frontend/src/lib/powerups.ts`:

| Old name | New name | Timer | Power-ups |
|---|---|---|---|
| `classic` | `duel` | 25 seconds | Enabled |
| `speed_round` | `classic` | 12 seconds | Disabled |

Update all references to mode IDs across backend and frontend. Update display names, taglines, and any hardcoded mode strings.

---

## 6. Danger Zone — Updated Thresholds

Update `src/modules/powerups/pools.ts` (or wherever constants live):
- `DANGER_ZONE_CHAIN_THRESHOLD`: 12 → **16**
- `DANGER_ZONE_MULTIPLIER`: 3 → **2**
- `DANGER_ZONE_TIMER_MS`: keep at **10000ms** (10 seconds)

Remove the chaos power-up drop on DZ entry. 2× scoring is the only DZ reward.

Update all frontend references to DZ threshold (chain length checks, UI strip, effect chips).

---

## 7. Frontend Updates

### `frontend/src/lib/powerups.ts`
- Update `PowerUpId` type to the 7 new IDs
- Update `POWER_UP_LABELS` with new emojis and names
- Update `POWER_UP_GUIDE` with correct descriptions, howItWorks, opponentDescription for all 7
- Update `GAME_MODES` with new mode names, timers, taglines
- Remove `DROP_TRIGGERS` section or update to reflect deterministic trigger system

### `frontend/src/app/game/page.tsx`
- Update `emptyInv` to match new `PowerUpInventory` shape
- Remove `swapPending` state and swap letter picker UI entirely
- Remove `typing_update` send (no Peek)
- Remove `swap_letter_chosen` WebSocket message handler
- Update effect chips (`myEffectChips`, `oppEffectChips`):
  - Remove: freeze (old), peek, blitzClaimed, swapPending
  - Add: doubleScore (`🎯 ${e.wordsRemaining}W`), wildPending (`🃏 Wild`), anchor (`⚓ ≥${e.minLength}`), tax (instant, no chip needed)
  - Keep: letterBomb, secondLifeArmed, blind (if kept — check)
- Update DZ threshold check from `12` to `16`
- Update `turnLocked` logic — Second Life can be activated anytime (not turn-locked), same for Freeze (it's your timer). Tax, Double, Wild, Anchor, Letter Bomb only on your turn.
- Update timer display — Duel mode = 25s base

---

## 8. Verification Checklist

Before finishing, confirm:

- [ ] `npm run type-check` passes in root (worker)
- [ ] `npm run type-check` passes in `frontend/`
- [ ] No references to removed power-up IDs (`peek`, `swap`, `steal`, `blitz`, `rush`) anywhere
- [ ] `emptyInventory()` in types.ts matches `emptyInv` in game/page.tsx
- [ ] `PowerUpId` in `src/modules/powerups/types.ts` matches `PowerUpId` in `frontend/src/lib/powerups.ts`
- [ ] DZ threshold is 16 in both backend (`pools.ts`) and frontend (`game/page.tsx`)
- [ ] Mode IDs `duel` and `classic` are consistent across backend and frontend
- [ ] Tax cannot reduce score below 0
- [ ] Double does not apply in DZ (DZ multiplier takes precedence)
- [ ] Wild skips chain rule validation entirely for one word
- [ ] Anchor validation is enforced in `WordValidator` not just GameRoom
- [ ] Second Life resets timer to 25s on both manual activation and auto-timeout
