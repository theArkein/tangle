# Chain Battle — Product Specification

**Real-time 2-Player Word Chain Game**
100% Free to Host • Zero API Costs • Progressive Web App

Version 1.1 | June 2026 | Confidential

---

## 1. Executive Summary

Chain Battle is a real-time, 2-player word chain game where opponents alternate playing words under time pressure. Each word must start with the last letter of the previous word. The game combines the accessibility of word games like Wordle with competitive multiplayer tension and a deep social layer.

The product is 100% free to host and operate using Cloudflare's free tier (Workers, Durable Objects, D1, Pages). There are zero third-party API costs. The entire infrastructure runs at $0/month until approximately 2,000 daily active users, at which point costs scale to ~$5/month. The game is built as a Progressive Web App (PWA) requiring no App Store or Play Store distribution.

### Design principles

- **Free forever:** No paid APIs, no per-use costs, no subscription required to operate. The game runs on free tiers indefinitely at small to medium scale.
- **Earned, not bought:** All power-ups, titles, and badges are earned through gameplay. No pay-to-win mechanics.
- **Social by default:** Every feature is designed to create connections. Rivals, leagues, share cards, spectating — the game is better with friends.
- **Ship fast, iterate:** MVP in 6 weeks. Validate the core loop before building depth.

---

## 2. Core Game Mechanics

### 2.1 Basic rules

- **Word chain:** Each word must start with the last letter of the previous word (e.g., tiger → rabbit → top → penguin).
- **Turn timer:** 15 seconds per turn in Classic mode. Timer accelerates as the chain grows.
- **Valid words:** English dictionary only (SOWPODS, ~270K words). No proper nouns, no abbreviations, no repeats within a match. Validated locally at the edge via Cloudflare D1 — zero API calls.
- **Match structure:** Best of 5 rounds. Each round starts with a new random seed letter. Win 3 rounds to win the match.
- **Round loss:** A player loses the round by timing out or playing an invalid word 8 times.
- **Between rounds:** Rounds do not auto-advance. After a round ends, both players see the result and must click "Play Again" to start the next round. If a player does not confirm within 30 seconds, they forfeit the match.

### 2.2 Scoring system

| Action | Points | Notes |
|--------|--------|-------|
| Word played (base) | +1 point per letter | "cat" = 3pts, "elephant" = 8pts |
| Rare letters (Q, X, Z, J) | 2× letter value | "quiz" = 4 + 2 bonus = 6pts |
| Long word bonus (8+ letters) | +5 bonus | Encourages vocabulary depth |
| Danger Zone words (20+ chain) | 3× all points | High-risk, high-reward end game |
| Word bounty (hidden target) | +10 bonus | 3 secret words per match |

### 2.3 Danger Zone

After 20 words in a single round, the chain enters the Danger Zone. The timer drops to 5 seconds, the UI shifts to a red-tinted urgency state, and all word scores are tripled. This creates maximum tension and is designed to be the "spectator moment" — the clip people share.

---

## 3. Power-Up System

Power-ups are earned through gameplay, never purchased. This is a core design principle that ensures competitive integrity and social trust.

### 3.1 Earning power-ups

Power-ups are earned **within a round** through play. Inventory is per-player and **resets at the start of every round** — each round is a fresh tactical canvas.

Each earning trigger maps to a **specific power-up category**. Players see clear cause-and-effect: defensive play styles earn defensive tools, vocabulary risk earns offensive disruption, etc. Within a category, selection is rarity-weighted (common 60% / uncommon 30% / rare 10%).

| Trigger | Pool drawn from | Frequency |
|---------|-----------------|-----------|
| Cross a score threshold within the round | Defensive (Freeze, Second Life…) | Every 15 points of round score |
| First rare-letter word in the round (Q/X/Z/J) | Offensive (Letter Bomb, Block…) | Once per round per player |
| First 8+ letter word in the round | Offensive (Letter Bomb, Block…) | Once per round per player |
| 10+ word chain in the round *(Phase 2)* | Disruption (Blind, Steal, Blitz…) | Once per round per player |
| Reach Danger Zone *(later)* | Chaos (Wildfire…) | Once per Danger Zone entry |

A single high-scoring word that crosses multiple thresholds at once awards multiple drops. The system is built around a **declarative power-up registry** — adding a new power-up is a one-file change with no engine modifications.

### 3.2 Complete power-up catalog

**Common (Starter)**

- **Freeze:** Pause opponent's timer for 5 seconds.
- **Second Life:** Survive one timeout without losing the round.

**Earned (Mid-tier)**

- **Letter Bomb:** Force opponent's next word to contain a hard letter (Q, X, Z, or J).
- **Block:** Reject opponent's word. They must replay with a different word, same timer.
- **Swap:** Change the ending letter of the chain to any letter of your choice.
- **Blind:** Hide the chain from your opponent for 2 turns.
- **Shrink:** Opponent's next word must be 4 letters or fewer.

**Rare (High-impact)**

- **Rush:** Cut opponent's timer in half for their next turn.
- **Steal:** Take opponent's last word and add its points to your score.
- **Peek:** See what your opponent is currently typing for 1 turn.
- **Blitz:** Play two words in a row, skipping opponent's turn.
- **Wildfire:** All words score 3× for the next 3 turns for both players.

---

## 4. Game Modes

| Mode | Description | Key rules | Players | Duration |
|------|-------------|-----------|---------|----------|
| Classic Duel | The core competitive experience. Best of 5 rounds. | 15s timer, all power-ups | 2 | 3–5 min |
| Speed Round | Single round, pure speed. First timeout loses. | 8s timer, no power-ups | 2 | 60–90s |
| Theme Battle | Words must fit rotating daily theme. | 20s timer, theme validation | 2 | 3–5 min |
| King of the Chain | Free-for-all elimination. | 12s, rotating turns, last standing | 4 | 3–7 min |
| Endless Co-op | Cooperative. Longest chain together vs clock. | Timer speeds up every 10 words | 2 | Until fail |
| Daily Gauntlet | Same seeds for everyone. One attempt/day. | 5 opponents, global leaderboard | 2 | ~10 min |

### 4.1 Mutators

- **Vowels Only:** Every word must begin with a vowel.
- **No E Allowed:** The letter E cannot appear in any word.
- **Minimum 6 Letters:** Short words banned.
- **Reversed:** Words must start with the second-to-last letter.
- **Double Chain:** Each word must start with the last two letters of the previous word.

---

## 5. Social System

### 5.1 Rivalry system

After 3+ matches against the same person, they become a rival. Tracks head-to-head record, memorable moments, longest chain together. Rivalry matches get special UI treatment and bonus XP (1.5×). This turns random opponents into recurring characters.

### 5.2 Friend leagues

Private leagues of 3–20 friends. Weekly seasons auto-reset Monday. League table, built-in chat, custom rules (e.g., Speed Round only, mutators always on).

### 5.3 Daily challenge broadcast

One challenge auto-sent daily to closest rival or random friend. Creates a daily open-the-app reason without requiring user initiation.

### 5.4 Spectator mode

Watch friends live. Send emoji reactions visible to both players. Top matches featured on a "Live" tab.

### 5.5 Share cards

Auto-generated match result image with full chain, color-coded words, power-ups used, and final score. One-tap sharing. Deep link back to the app — every share is user acquisition.

### 5.6 Word reactions

Mid-game reaction bar after each word. Real-time delivery. Custom emoji packs (wholesome, snarky, unhinged) unlockable.

---

## 6. Customization & Progression

### 6.1 Title system

| Title | Requirement | Badge color |
|-------|-------------|-------------|
| Apprentice | Create an account | Gray |
| Word Slinger | Win 10 matches | Green |
| Chain Forger | Win 50 matches + 20-word chain | Blue |
| Wordsmith | Win 200 matches + 500 unique words | Purple |
| Chain Lord | Win 500 matches + top 100 ELO | Gold |
| Lexicon | Win 1000 matches + 40-word co-op chain | Animated gold |

### 6.2 Achievement badges

- **Vocab Lord:** Use 500 unique words.
- **Speed Demon:** Win 10 Speed Round matches.
- **Chain Master:** 50+ word chain in Endless Co-op.
- **Comeback King:** Win after being down 0–2.
- **Linguist:** Win a Theme Battle in every theme.
- **Danger Dweller:** Survive 10 Danger Zone sequences.
- **Rival Hunter:** Establish 5 rivalries.
- **Tournament Victor:** Win a Weekend Tournament.

### 6.3 Visual customization

- **Chain Themes:** Neon, retro pixel, handwritten, minimal, dark. Unlocked by level.
- **Word Effects:** Shimmer, bounce, flame trail on 8+ letter words. Unlocked by achievements.
- **Reaction Packs:** Default, snarky, wholesome, unhinged. Earned through social milestones.
- **Sound Themes:** Classic clicks, synthwave, lo-fi, mechanical typewriter. Free, toggleable.

### 6.4 XP system

| Action | XP | Multiplier | Notes |
|--------|----|-----------|-------|
| Win a match | +100 XP | — | Base reward |
| Lose a match | +30 XP | — | Always earn something |
| Rivalry match | Base ×1.5 | 1.5× | Encourages rematches |
| Daily Gauntlet | Base ×2 | 2× | Once per day |
| Reach Danger Zone | +50 bonus | — | Rewards long chains |

---

## 7. Spice-Ups & Retention

- **Comeback mechanic:** Down 0–2 triggers Last Stand: +3s per turn, 1.5× scoring.
- **Mystery letter drops:** Bonus letters mid-chain grant 2× multiplier. Opponent can steal on next turn.
- **Word bounties:** 3 hidden target words per match, +10 bonus for using one.
- **Weekend tournaments:** 32-player bracket every Saturday. Free entry. Exclusive rewards for top 4.

---

## 8. Technical Architecture

The entire stack runs on free tiers with zero monthly cost at launch. The recommended approach is an all-Cloudflare architecture, keeping everything on a single platform with no inactivity pauses, no cold starts, and global edge deployment.

### 8.1 Primary stack: all-Cloudflare (recommended)

| Layer | Service | Free tier limits | Usage in Chain Battle |
|-------|---------|-----------------|----------------------|
| Frontend | Cloudflare Pages | Unlimited bandwidth, 500 builds/mo | Next.js static export + PWA shell. Served from edge CDN globally. |
| API / Logic | Cloudflare Workers | 100K requests/day, 10ms CPU | Match API, scoring, ELO calculation, friend invites, push notifications. |
| Realtime | Durable Objects | 100K requests/day | Each game room is a Durable Object holding a WebSocket pair. Stateful turn relay, timer management, power-up state. |
| Database | Cloudflare D1 | 5 GB storage, 5M reads/day, 100K writes/day | Player profiles, match history, ELO, friends, leagues, leaderboards. Dictionary lookup (270K words). |
| Key-value | Workers KV | 1 GB, 100K reads/day | Session tokens, rate limiting, online status, matchmaking queue. |
| File storage | Cloudflare R2 | 10 GB, 1M ops/month | Share card images (auto-generated match results). Profile avatars if added later. |
| Auth | Custom (Workers) | Included in Workers | Anonymous accounts with optional Google/Apple OAuth. JWT tokens stored in KV. |
| Dictionary | D1 (preloaded) | Included in D1 | SOWPODS word list (~270K words, ~1.8MB gzipped) loaded into D1. Edge-local validation, zero latency. |

### 8.2 Alternative stack: Cloudflare + Supabase

If you prefer a managed database with a dashboard and built-in auth UI, Supabase can replace D1 and the custom auth layer. The trade-off is the inactivity pause on the free tier (projects pause after 1 week with no traffic, solvable with a free cron ping).

| Layer | Service | Free limits | Notes |
|-------|---------|-------------|-------|
| Database + Auth | Supabase | 500 MB DB, 50K MAU, 5 GB bandwidth | Managed Postgres, built-in Google/Apple auth, admin dashboard |
| Realtime | Durable Objects | 100K req/day | Still Cloudflare for WebSockets |
| Frontend | Vercel or CF Pages | 100 GB BW (Vercel) | Either works, Pages is simpler |

### 8.3 Cost projection

| Scale (DAU) | Monthly cost | Bottleneck | Action needed |
|-------------|-------------|-----------|---------------|
| 0 – 500 | **$0** | None | Stay on free tier |
| 500 – 2,000 | **$0** | Approaching Worker limits | Monitor daily request count |
| 2,000 – 5,000 | **~$5** | Workers paid plan needed | Upgrade to Workers Paid ($5/mo) |
| 5,000 – 10,000 | **~$15–30** | Durable Object usage | Scale is usage-based, predictable |
| 10,000+ | **~$30–50** | D1 reads, DO connections | Well within cosmetic revenue range |

At 10,000 DAU, the estimated $30–50/month cost is trivially covered by even minimal cosmetic purchases. The game reaches profitability almost immediately once monetization is enabled in Phase 2.

### 8.4 Why all-Cloudflare over multi-vendor

- **No inactivity pauses:** Unlike Supabase's free tier, Cloudflare services don't pause when idle.
- **Single account:** One dashboard, one billing page, one deployment pipeline. No vendor coordination.
- **Edge-first:** Workers and Durable Objects run at 300+ locations globally. A player in Nepal and a player in Brazil get the same low latency.
- **Open source escape hatch:** Workers runtime (workerd) is open source. If Cloudflare ever changes pricing, you can self-host.
- **WebSocket support:** Durable Objects natively support WebSockets with hibernation — idle connections don't cost CPU time.

---

## 9. Phased Development Roadmap

### 9.1 MVP (Weeks 1–6)

**Goal:** Prove the core loop is fun. Two players can find each other, play a word chain battle, and want to play again.

#### Core game engine

| Feature | Scope | Priority | Week |
|---------|-------|----------|------|
| Word chain logic | D1 dictionary lookup, last-letter matching, duplicate detection | Must | Week 1 |
| Turn timer | 15s countdown via Durable Object, auto-forfeit on timeout | Must | Week 1 |
| Scoring | Per-letter scoring, rare letter bonus, long word bonus | Must | Week 1 |
| Match structure | Best of 5 rounds, random seed letters, win detection | Must | Week 2 |

#### Multiplayer

| Feature | Scope | Priority | Week |
|---------|-------|----------|------|
| Durable Object rooms | Each game = one DO, WebSocket pair, stateful turn relay | Must | Week 2 |
| Matchmaking | Workers KV queue: press Play, get matched with a waiting player | Must | Week 3 |
| Friend invite | Shareable link (DO room ID in URL) to challenge a specific person | Must | Week 3 |

#### User interface

| Feature | Scope | Priority | Week |
|---------|-------|----------|------|
| Game screen | Chain display, timer, input field, player indicators | Must | Week 3–4 |
| Lobby / home | Play button, friend invite, recent matches | Must | Week 4 |
| Result screen | Match summary, word-by-word replay, rematch button | Must | Week 4 |

#### Infrastructure

| Feature | Scope | Priority | Week |
|---------|-------|----------|------|
| Auth | Anonymous accounts with optional Google/Apple OAuth via Workers | Must | Week 5 |
| Match history | Store past 50 matches per user in D1 | Should | Week 5 |
| ELO ranking | Basic +/– points per match based on opponent ELO | Should | Week 5–6 |
| PWA + deploy | Cloudflare Pages deploy, installable PWA, Web Push for challenges | Must | Week 6 |

**MVP success metric:** 50% of first-time players complete 2+ matches. 20% return within 48 hours.

---

### 9.2 Phase 1 — Social & stickiness (Weeks 7–12)

**Goal:** Turn the game into a daily habit. Players come back because of people, not just puzzles.

#### Social layer

| Feature | Scope | Priority | Week |
|---------|-------|----------|------|
| Rivalry system | Auto-detect after 3 matches, head-to-head stats, special UI | Must | Week 7 |
| Friend list | Add by link or username, online status via KV | Must | Week 7 |
| Daily challenge | Auto-send one challenge/day to rival or friend | Must | Week 8 |
| Share cards | Auto-generated image via R2, one-tap share with deep link | Must | Week 8–9 |
| Word reactions | Mid-game reaction bar, real-time via Durable Object | Should | Week 9 |

#### Power-ups (Tier 1)

| Feature | Scope | Priority | Week |
|---------|-------|----------|------|
| Freeze + Second Life | Common abilities, earned on round win | Must | Week 10 |
| Letter Bomb + Block | Earned on 10+ word chains | Must | Week 10 |

#### Progression

| Feature | Scope | Priority | Week |
|---------|-------|----------|------|
| XP system | Earn XP per match, level up, unlock visual rewards | Must | Week 11 |
| Title system | Apprentice through Lexicon | Must | Week 11 |
| First 4 badges | Vocab Lord, Speed Demon, Chain Master, Comeback King | Should | Week 12 |

**Phase 1 success metric:** Day 7 retention = 30%. 40% of matches from friend challenges.

---

### 9.3 Phase 2 — Depth & modes (Weeks 13–20)

**Goal:** Give veterans a reason to stay. Expand possibility space without overwhelming new players.

#### New game modes

| Feature | Scope | Priority | Week |
|---------|-------|----------|------|
| Speed Round | 8s timer, single round, no power-ups | Must | Week 13 |
| Theme Battle | Daily rotating theme, theme validation engine | Must | Week 14 |
| Endless Co-op | 2-player co-op, shared global leaderboard | Should | Week 15 |
| Daily Gauntlet | 5 seed letters, one attempt/day, global ranking | Must | Week 16 |

#### Power-ups (Tier 2)

| Feature | Scope | Priority | Week |
|---------|-------|----------|------|
| Swap, Blind, Shrink | Mid-tier earned abilities | Must | Week 17 |
| Rush, Steal, Peek, Blitz | Rare abilities from streaks and Danger Zone | Must | Week 17–18 |
| Wildfire | 3× scoring for both, 3 turns | Should | Week 18 |

#### Social expansion

| Feature | Scope | Priority | Week |
|---------|-------|----------|------|
| Friend Leagues | 3–20 player leagues, weekly seasons, chat | Must | Week 19 |
| Spectator mode | Watch friends live, emoji reactions, featured matches | Should | Week 19–20 |

#### Customization

| Feature | Scope | Priority | Week |
|---------|-------|----------|------|
| Chain themes | 5 visual themes, unlocked by level | Should | Week 20 |
| Word effects | Animations on 8+ letter words | Nice | Week 20 |

**Phase 2 success metric:** Day 30 retention = 18%. 3+ modes with >10% play share. Leagues avg 5+ members.

---

### 9.4 Phase 3 — Community & events (Weeks 21–28)

**Goal:** Build a self-sustaining community with its own content and events.

#### Competitive

| Feature | Scope | Priority | Week |
|---------|-------|----------|------|
| Weekend tournaments | 32-player bracket every Saturday, exclusive rewards | Must | Week 21–22 |
| King of the Chain | 4-player free-for-all mode | Should | Week 23 |
| Ranked seasons | Monthly ELO reset with seasonal rewards | Must | Week 24 |

#### Chaos & variety

| Feature | Scope | Priority | Week |
|---------|-------|----------|------|
| Mutator system | 5 mutators: Vowels Only, No E, Min 6, Reversed, Double Chain | Must | Week 25 |
| Mystery drops + bounties | Bonus letters and hidden target words | Should | Week 25–26 |
| Comeback mechanic | Last Stand at 0–2: +3s, 1.5× scoring | Must | Week 26 |

#### Polish

| Feature | Scope | Priority | Week |
|---------|-------|----------|------|
| Reaction packs + sounds | 4 emoji packs, 4 audio themes | Should | Week 27 |
| Full badge system | All 8 badges with progress tracking | Must | Week 27–28 |
| Profile page | Stats, badges, rivals, title, shareable link | Must | Week 28 |

**Phase 3 success metric:** 10K+ WAU. Tournaments fill within 1 hour. 25% of DAU from push notifications.

---

## 10. Monetization

Core gameplay is free forever. Monetization is cosmetic-only and introduced in Phase 2 after retention is proven.

- **Chain Themes (premium):** Additional visual themes. $0.99 each or $2.99 bundle.
- **Reaction Packs (premium):** Exclusive emoji packs. $0.99 each.
- **Ad-supported tier:** Optional 5-second interstitial between matches. Any cosmetic purchase = ad-free forever.
- **Tournament entry (future):** Premium brackets with better rewards. $0.99 entry. Prize: exclusive cosmetics.

At the estimated hosting costs ($0–50/month depending on scale), the break-even point requires fewer than 50 cosmetic purchases per month at $0.99 each. The game is profitable almost immediately once monetization is enabled.