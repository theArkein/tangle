# Gameplay Priority — 2-Player Focus

Filtered from phases 1–3 of the product spec. Focus: deliver the best 2-player game experience before adding social infrastructure.

Each feature is tagged `implement` or `skip`. Filter by tag to get the current build list.

---

## Phase 1 — Social & Stickiness (Weeks 7–12)

**Revised earning model for Phase 1:** Power-ups are earned mid-round through a **registry-based, category-bound** drop system. Each trigger maps to a specific category — score thresholds award defensive power-ups, special-word play awards offensive ones. Adding new power-ups in later phases is a one-file change. See `docs/product-specs.md` §3.1.

**Additional Phase 1 changes:**
- Lives per round: **3 → 8 faults** before a player loses the round.
- Rounds no longer auto-advance — both players must click "Play Again" to start the next round. 30s timeout → opponent forfeits.

| Feature | Status | Reason |
|---------|--------|--------|
| Power-up: Freeze | `implement` | Core in-game tension, directly affects both players |
| Power-up: Second Life | `implement` | Survival mechanic, extends round drama |
| Power-up: Letter Bomb | `implement` | Forces hard letters on opponent, strategic depth |
| Power-up: Block | `implement` | Forces opponent replay, disruption mechanic |
| Word reactions (mid-game) | `implement` | Real-time emotional feedback during play, immersive |
| XP system | `implement` | Sense of progress across sessions |
| Title system (Apprentice → Lexicon) | `implement` | Player identity, long-term goal |
| Rivalry system | `skip` | Social — add later |
| Friend list + online status | `skip` | Social — add later |
| Daily challenge broadcast | `skip` | Social — add later |
| Share cards | `skip` | Social — add later |
| First 4 badges | `skip` | Polish — defer until core loop is solid |

---

## Phase 2 — Depth & Modes (Weeks 13–20)

| Feature | Status | Reason |
|---------|--------|--------|
| Speed Round (8s timer, no power-ups) | `implement` | Distinct high-intensity mode, pure skill |
| Theme Battle (daily rotating theme) | `skip` | Creative constraint that reframes each session |
| Endless Co-op | `skip` | Cooperative variant — completely different 2-player dynamic |
| Daily Gauntlet | `skip` | Leaderboard-dependent — needs social layer first |
| Power-up: Swap | `implement` | Changes chain direction, high strategic impact |
| Power-up: Blind | `implement` | Hides chain from opponent, psychological pressure |
| Power-up: Shrink | `implement` | Forces short words, disrupts opponent's rhythm |
| Power-up: Rush | `implement` | Cuts opponent's timer, high-stakes rare ability |
| Power-up: Steal | `implement` | Takes opponent's last word + points, dramatic swing |
| Power-up: Peek | `implement` | See opponent typing, mind-game rare ability |
| Power-up: Blitz | `implement` | Double turn, skip opponent — high-impact rare |
| Power-up: Wildfire | `implement` | 3× scoring for both players, 3 turns — chaos mode |
| Chain themes (5 visual themes) | `skip` | Visual polish, makes game feel alive |
| Word effects (animations on 8+ letters) | `implement` | Rewarding feedback for strong play |
| Friend Leagues | `skip` | Social — add later |
| Spectator mode | `skip` | Social — add later |

---

## Phase 3 — Community & Events (Weeks 21–28)

| Feature | Status | Reason |
|---------|--------|--------|
| Mutator: Vowels Only | `skip` | Reframes core game, high replay variety |
| Mutator: No E Allowed | `skip` | Reframes core game, high replay variety |
| Mutator: Minimum 6 Letters | `skip` | Reframes core game, high replay variety |
| Mutator: Reversed (second-to-last letter) | `skip` | Reframes core game, high replay variety |
| Mutator: Double Chain (last 2 letters) | `skip` | Reframes core game — already partially built |
| Mystery letter drops | `skip` | Mid-match surprise, keeps both players on edge |
| Word bounties (3 hidden targets) | `skip` | Hidden goals add tension throughout the match |
| Comeback mechanic — Last Stand (0–2) | `skip` | Prevents blowouts, sustains tension until the end |
| Audio themes (4 sound packs) | `implement` | Atmosphere, cheap immersion win |
| Weekend tournaments | `skip` | Social/competitive infra — add later |
| King of the Chain (4-player) | `skip` | Out of scope — 2-player focus |
| Ranked seasons | `skip` | Needs stable player base first |
| Reaction packs (emoji packs) | `skip` | Defer until word reactions baseline is proven |
| Full badge system (all 8) | `skip` | Polish — add with social layer |
| Profile page | `skip` | Social — add later |
