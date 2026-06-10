# Gameplay Redesign Decisions

## Power-Ups — Final Set (7 total)

| Emoji | Name | What it does | When to activate |
|---|---|---|---|
| ❄️ | Freeze | Add 5 seconds to your own turn timer | Your turn |
| 💚 | Second Life | Auto-survive one timeout without losing the round | Automatic |
| 💣 | Letter Bomb | Force opponent's next word to contain Q, X, Z, or J | Your turn |
| 🎯 | Double | Your next 3 words each score 2× points | Your turn |
| 🃏 | Wild | Your next word can start with any letter (ignores chain rule) | Your turn |
| ⚓ | Anchor | Opponent's next word must be 6+ letters | Your turn |
| 💸 | Tax | Reduce opponent's current round score by 10 points | Your turn |

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
| Rush ⚡ | Replaced by Tax — timer manipulation was opaque/indeterministic for opponent |

### Reworked

**❄️ Freeze**
- Before: Cut opponent's timer (described as "pause opponent's timer" — confusing)
- After: Adds 5 seconds to YOUR own timer
- Why: Self-targeting makes the benefit immediately clear

### New

**🎯 Double** — Your next 3 words score 2×. Does not stack with Danger Zone multiplier.

**🃏 Wild** — Your next word can start with any letter. Replaces Shrink. Solves being stuck on a brutal letter combo.

**⚓ Anchor** — Opponent's next word must be 6+ letters. Opposite pressure to Letter Bomb.

**💸 Tax** — Reduces opponent's current round score by 10 points instantly. Replaces Rush.

### Deferred / Revisit Later
Shield, Skip, Gamble, Lenient, Seal, Boost, Loop, Spin

---

## Rounds & Match

| Decision | Value |
|---|---|
| Match format | Open-ended — players decide how many rounds to play |
| Round win condition | First player to lead by **59 points** wins the round (59 = T+A+N+G+L+E alphabet positions: 20+1+14+7+12+5) |
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
| Timer | **10 seconds** per turn |
| Scoring | **2×** everything |
| Power-up drop on entry | **None** — 2× scoring is the reward itself |

---

## Power-Up Earning Triggers (Deterministic)

Each trigger always earns one specific power-up. Players can strategise around earning them.

| Trigger | Earns | Notes |
|---|---|---|
| Every 25 points you score | ❄️ Freeze | Unlimited — every 25pt milestone (25, 50, 75, 100...) |
| Play a 10+ letter word | 🎯 Double | Any time |
| Word contains Q, X, Z or J | 💣 Letter Bomb | Any time |
| Play an 8+ letter word | ⚓ Anchor | Any time |
| Play any word in Danger Zone | 💸 Tax | Any time in DZ |
| Every 6 words you play | 🃏 Wild | Resets per player (6, 12, 18...) — 6 = letters in TANGLE |
| Single word scores 15+ points | 💚 Second Life | Any time |
| Word uses 4+ different vowels | 💚 Second Life | Any time (e.g. sequoia, education) |
| Word contains letters from 2+ rare tiers | 💚 Second Life | Any time (e.g. "quickly" = Q Tier 1 + K Tier 2) |

> **Second Life** has 3 earning paths — any one triggers it.
> **Activation:** auto-activates when timer hits 0 (saves the round), OR player can manually activate at any point during their turn. Either way → full timer reset to **25 seconds**.

---

## Implementation Notes

### Freeze
- Extend current alarm by 5000ms
- Shift `stored.turnStartAt` forward by 5000ms so client timer reflects the extension
- Instant effect, no persistent ActiveEffect needed

### Double
- ActiveEffect: `{ kind: "doubleScore"; forPlayerId: PlayerId; wordsRemaining: number }`
- Consumed after 3 words (decrement wordsRemaining on each submission)
- 2× multiplier not applied during Danger Zone (DZ takes precedence)

### Wild
- ActiveEffect: `{ kind: "wildPending"; forPlayerId: PlayerId }`
- Skip the 1-letter chain validation for one word submission
- Consumed after one use

### Anchor
- ActiveEffect: `{ kind: "anchor"; onPlayerId: PlayerId; minLength: number }`
- minLength = 6
- Consumed on opponent's next word submission
- Validation rejects words shorter than minLength

### Tax
- Instant effect, no persistent ActiveEffect
- Deduct 10 from opponent's current round score (floor at 0, cannot go negative)
- Broadcast score update to both players immediately

### Second Life
- Auto-activates when timer hits 0 (saves the round, player doesn't lose)
- Can also be manually activated at any point during player's turn
- On activation: full timer reset to 25 seconds

### Second Life Trigger Evaluation (per word submission)
Check all 3 paths after each valid word:
1. `scoreResult.points >= 15`
2. `countUniqueVowels(word) >= 4`
3. `hasLettersFromMultipleRareTiers(word, 2)`

If any condition is true → award Second Life to that player.

### Wild Trigger Evaluation
- Track `playerWordCount` per player per round
- Award Wild when `playerWordCount % 6 === 0`

### Danger Zone
- Chain threshold: 16 words (was 12)
- Multiplier: 2× (was 3×)
- No power-up drop on entry
- Timer: 10 seconds per turn

### Round Win
- Check after every word submission: if `(playerRoundScore - opponentRoundScore) >= 59`, round ends, player wins
- No fallback needed — DZ (2× scoring at chain 16) and power-ups (Tax −10, Double 2×) naturally accelerate the gap
- Replace fault-based round end logic

---

## Files to Change

1. `src/modules/powerups/types.ts` — update PowerUpId, ActiveEffect union, emptyInventory
2. `src/modules/powerups/` — delete old files (freeze, peek, swap, steal, blitz, rush), create `double.ts`, `wild.ts`, `anchor.ts`, `tax.ts`, update `freeze.ts`
3. `src/modules/powerups/index.ts` — update registry and re-exports
4. `src/modules/PowerUpEngine.ts` — remove old cases/helpers, add new activation + trigger evaluation logic
5. `src/durable-objects/GameRoom.ts` — remove old handlers, wire up new mechanics
6. `src/modules/MatchStateMachine.ts` — update round end condition (score-based), remove fault limit logic
7. `src/modules/powerups/pools.ts` — update DZ threshold to 16, multiplier to 2×, remove pool-based drops
8. `src/modules/ScoringEngine.ts` — add rare letter tier support (3 tiers), update multiplier logic
9. `src/modules/gameModes.ts` — update Duel (25s), Classic (12s), rename modes
10. `frontend/src/lib/powerups.ts` — update PowerUpId type, POWER_UP_LABELS, POWER_UP_GUIDE
11. `frontend/src/app/game/page.tsx` — update emptyInv, effect chips, remove Swap UI, update DZ threshold display
