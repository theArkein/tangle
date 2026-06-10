# Power-Up Redesign Decisions

## Final Power-Up Set (7 total)

| Emoji | Name | What it does | When to activate |
|---|---|---|---|
| ❄️ | Freeze | Add 5 seconds to your own turn timer | Your turn |
| 💚 | Second Life | Auto-survive one timeout without losing the round | Automatic |
| 💣 | Letter Bomb | Force opponent's next word to contain Q, X, Z, or J | Your turn |
| ⚡ | Rush | Halve opponent's timer for their next turn | Your turn |
| 🎯 | Double | Your next 3 words each score 2× points | Your turn |
| 🃏 | Wild | Your next word can start with any letter (ignores chain rule) | Your turn |
| ⚓ | Anchor | Opponent's next word must be 6+ letters | Your turn |

---

## Removed from Original 12

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

---

## Reworked Power-Ups

### ❄️ Freeze
- **Before:** Cut opponent's timer by 5 seconds (described as "pause opponent's timer" — confusing)
- **After:** Adds 5 seconds to YOUR own timer
- **Why:** Original description was ambiguous ("pausing" sounds like helping opponent). Self-targeting makes the benefit immediately clear.

---

## New Power-Ups

### 🎯 Double
- Your next 3 words score 2×
- Does not stack with Danger Zone multiplier

### 🃏 Wild
- Your next word can start with any letter
- Replaces Shrink
- Solves the pain point of being stuck on a brutal letter combo

### ⚓ Anchor
- Opponent's next word must be 6+ letters
- Minimum length = 6
- Opposite pressure to Letter Bomb

---

## Deferred / Not Confirmed (revisit later)

- 🛡️ Shield — dispel last offensive effect used against you (deferred, timing complexity with Rush)
- ⏭️ Skip — opponent loses their next turn
- 🎲 Gamble — next word scores 3× or 0, random flip
- 🪄 Lenient — next word only needs to match last 1 letter instead of 2
- 🔐 Seal — opponent cannot use power-ups on their next turn
- 💰 Tax — steal 5 points from opponent's round score
- ⬆️ Boost — flat +6 bonus on your next word
- 🔁 Loop — opponent must start their next word with the same letters as their last word
- 🌀 Spin — randomise required starting letters for opponent's next turn

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
- Skip the 2-letter chain validation for one word submission
- Consumed after one use

### Anchor
- ActiveEffect: `{ kind: "anchor"; onPlayerId: PlayerId; minLength: number }`
- minLength = 6
- Consumed on opponent's next word submission
- Validation rejects words shorter than minLength

---

## Files to Change

1. `src/modules/powerups/types.ts` — update PowerUpId, ActiveEffect union, emptyInventory
2. `src/modules/powerups/` — delete 8 old files, create `double.ts`, `wild.ts`, `anchor.ts`, update `freeze.ts`
3. `src/modules/powerups/index.ts` — update registry and re-exports
4. `src/modules/PowerUpEngine.ts` — remove old cases/helpers, add new activation logic
5. `src/durable-objects/GameRoom.ts` — remove old handlers, wire up new power-up mechanics
6. `frontend/src/lib/powerups.ts` — update PowerUpId type, POWER_UP_LABELS, POWER_UP_GUIDE
7. `frontend/src/app/game/page.tsx` — update emptyInv, effect chips, remove Swap UI, update turnLocked logic
