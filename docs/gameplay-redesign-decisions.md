# Gameplay Redesign Decisions

## Power-Ups — Final Set (7 total)

| Emoji | Name | What it does | When to activate |
|---|---|---|---|
| ❄️ | Freeze | Add 5 seconds to your own turn timer | Your turn |
| 💚 | Second Life | Auto-survive one timeout without losing the round | Automatic |
| 💣 | Letter Bomb | Force opponent's next word to contain Q, X, Z, or J | Your turn |
| ⚡ | Rush | Halve opponent's timer for their next turn | Your turn |
| 🎯 | Double | Your next 3 words each score 2× points | Your turn |
| 🃏 | Wild | Your next word can start with any letter (ignores chain rule) | Your turn |
| ⚓ | Anchor | Opponent's next word must be 6+ letters | Your turn |

### Removed from Original 12

| Power-up | Reason |
|---|---|
| Block 🛑 | Too punishing/frustrating for opponent |
| Blind 🙈 | Removed for simplicity |
| Wildfire 🔥 | Removed for simplicity |
| Swap 🔀 | Two-step interaction, consumes your turn, confusing value |
| Steal 🪝 | Complex chain mutation + point transfer, hard to follow |
| Peek 👁️ | Low impact, not exciting |
| Blitz ⚔️ | Breaks turn rhythm, confusing |
| Shrink 🤏 | Replaced by Wild |

### Reworked

**❄️ Freeze**
- Before: Cut opponent's timer (described as "pause opponent's timer" — confusing)
- After: Adds 5 seconds to YOUR own timer
- Why: Self-targeting makes the benefit immediately clear

### New

**🎯 Double** — Your next 3 words score 2×. Does not stack with Danger Zone multiplier.

**🃏 Wild** — Your next word can start with any letter. Replaces Shrink. Solves being stuck on a brutal letter combo.

**⚓ Anchor** — Opponent's next word must be 6+ letters. Opposite pressure to Letter Bomb.

### Deferred / Revisit Later
Shield, Skip, Gamble, Lenient, Seal, Tax, Boost, Loop, Spin

---

## Rounds & Match

| Decision | Value |
|---|---|
| Match format | Open-ended — players decide how many rounds to play |
| Round win condition | First to **100 points** wins the round |
| Chain rule | Word must start with the last **1 letter** of the previous word (already implemented) |
| Fault penalty | **−2 seconds** from turn timer per invalid word (replaces fault lives) |

**Invalid word = any of:**
- Not in the dictionary
- Already used in the chain
- Doesn't start with the required letter
- Doesn't meet active power-up constraints (Letter Bomb, Anchor)

---

## Timers

| Mode | Turn Timer | Power-Ups |
|---|---|---|
| **Duel** (renamed from Classic) | 25 seconds | Enabled |
| **Classic** (renamed from Speed Round) | 12 seconds | Disabled |

---

## Scoring

| Component | Value |
|---|---|
| Base | 1 point per letter |
| Long word bonus | +5 if word is 8+ letters |
| Danger Zone multiplier | 2× everything |

**Rare Letter Tiers:**

| Tier | Letters | Bonus |
|---|---|---|
| 🔴 Top | Q, X, Z, J | +3 pts each |
| 🟡 Mid | V, K, W | +2 pts each |
| 🟢 Low | F, H, Y, B | +1 pt each |

---

## Danger Zone

| Decision | Value |
|---|---|
| Triggers at | Chain reaches **16 words** |
| Effect | Turn timer drops, scoring becomes **2×** |
| Power-up drop on entry | **None** — 2× scoring is the reward itself |

---

## Power-Up Earning Triggers
*(To be discussed)*

---

## Implementation Notes

### Freeze
- Extend current alarm by 5000ms
- Shift `stored.turnStartAt` forward by 5000ms so client timer reflects the extension
- Instant effect, no persistent ActiveEffect needed

### Double
- ActiveEffect: `{ kind: "doubleScore"; forPlayerId: PlayerId; wordsRemaining: number }`
- Consumed after 3 words (decrement wordsRemaining on each submission)
- 2× multiplier applied only when no Danger Zone active

### Wild
- ActiveEffect: `{ kind: "wildPending"; forPlayerId: PlayerId }`
- Skip the 1-letter chain validation for one word submission
- Consumed after one use

### Anchor
- ActiveEffect: `{ kind: "anchor"; onPlayerId: PlayerId; minLength: number }`
- minLength = 6
- Consumed on opponent's next word submission
- Validation rejects words shorter than minLength

### Danger Zone
- Chain threshold: 16 words (was 12)
- Multiplier: 2× (was 3×)
- No power-up drop on entry (was chaos pool drop)
- Timer: TBD (currently 10s — discuss)

### Round Win
- Check after every word submission: if playerRoundScore >= 100, round ends, player wins
- Replace fault-based round end logic

---

## Files to Change

1. `src/modules/powerups/types.ts` — update PowerUpId, ActiveEffect union, emptyInventory
2. `src/modules/powerups/` — delete 8 old files, create `double.ts`, `wild.ts`, `anchor.ts`, update `freeze.ts`
3. `src/modules/powerups/index.ts` — update registry and re-exports
4. `src/modules/PowerUpEngine.ts` — remove old cases/helpers, add new activation logic
5. `src/durable-objects/GameRoom.ts` — remove old handlers, wire up new mechanics (round win at 100, fault penalty −2s, DZ at 16 words)
6. `src/modules/MatchStateMachine.ts` — update round end condition (score-based), remove fault limit logic
7. `src/modules/powerups/pools.ts` — update DZ threshold to 16, multiplier to 2×
8. `frontend/src/lib/powerups.ts` — update PowerUpId type, POWER_UP_LABELS, POWER_UP_GUIDE
9. `frontend/src/app/game/page.tsx` — update emptyInv, effect chips, remove Swap UI, update DZ threshold
