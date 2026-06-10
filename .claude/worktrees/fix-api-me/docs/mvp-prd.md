# PRD: Chain Battle — MVP

**Scope:** Weeks 1–6  
**Goal:** Two players can find each other, play a word chain battle, and want to play again.  
**Success metric:** 50% of first-time players complete 2+ matches. 20% return within 48 hours.

---

## Problem Statement

Word game fans have no real-time, head-to-head word chain experience available as a PWA. Existing word games (Wordle, Scrabble-variants) are either single-player, turn-based async, or require app store installs. Players who want a quick, competitive vocabulary duel with a friend or stranger have nowhere to go that combines instant matchmaking, live time pressure, and zero install friction.

---

## Solution

Chain Battle is a real-time 2-player word chain game delivered as a Progressive Web App with zero install required. Players alternate submitting words where each word must begin with the last letter of the previous word. A 15-second turn timer creates urgency. Matches are best of 5 rounds. The MVP proves the core loop is fun and validates retention before any social or power-up complexity is added.

The entire stack runs on Cloudflare's free tier (Workers, Durable Objects, D1, KV, Pages) with no third-party API costs and no monthly hosting fees at MVP scale.

---

## User Stories

1. As a new visitor, I want to open the game in my mobile browser without installing anything, so that I can start playing immediately with zero friction.
2. As a new visitor, I want an anonymous account created automatically on first visit, so that I can play without filling out a registration form.
3. As a player, I want to link my Google or Apple account to my anonymous profile, so that I can recover my account on a new device.
4. As a player, I want to press a single Play button to enter matchmaking, so that I'm matched with an opponent without any configuration.
5. As a player, I want to see a live status indicator while waiting for an opponent, so that I know the system is working and haven't been forgotten.
6. As a player, I want to send a shareable invite link to a specific friend, so that we can play directly against each other without going through matchmaking.
7. As a player, I want to open a friend's invite link and land directly in their game room, so that joining a specific match requires no extra steps.
8. As a player, I want to see the current chain of words played this round, so that I know which letter my word must start with.
9. As a player, I want a clearly visible countdown timer for my turn, so that I feel the time pressure and know exactly how long I have.
10. As a player, I want to type a word and submit it during my turn, so that I can extend the chain.
11. As a player, I want immediate feedback if my word is invalid (wrong starting letter, not in dictionary, already used), so that I can correct my entry while time remains.
12. As a player, I want my opponent's turn to be clearly indicated, so that I know when to wait and when it's my turn.
13. As a player, I want to see my opponent's submitted word appear on the chain in real time, so that I can immediately start thinking of my response.
14. As a player, I want to automatically lose a round if my timer reaches zero, so that the match continues without stalling.
15. As a player, I want to see a count of remaining invalid attempts (3 allowed per round), so that I know how close I am to forfeiting the round.
16. As a player, I want to automatically lose a round after 3 invalid word submissions, so that the match enforces fair play.
17. As a player, I want each round to start with a randomly seeded letter, so that no round feels like a repeat of a previous one.
18. As a player, I want to see my current round score update in real time as I play words, so that I understand the point value of long and rare-letter words.
19. As a player, I want words with rare letters (Q, X, Z, J) to score double, so that risky high-value plays feel rewarding.
20. As a player, I want words of 8+ letters to earn a +5 bonus, so that vocabulary depth is rewarded alongside speed.
21. As a player, I want to see which player won each round as it completes, so that I can track my progress toward winning the match.
22. As a player, I want to win the match by winning 3 of 5 rounds, so that a single bad round doesn't end the game.
23. As a player, I want the match to end immediately when one player wins their third round, so that I don't play out meaningless rounds.
24. As a player, I want to see a match result screen with the full word-by-word replay, so that I can review what happened after the match ends.
25. As a player, I want to see both players' final scores on the result screen, so that I understand the margin of victory.
26. As a player, I want a rematch button on the result screen, so that I can immediately challenge the same opponent again.
27. As a player, I want to see my recent match history on the home screen, so that I can track my performance over time.
28. As a player, I want my ELO rating to update after each match, so that I have a meaningful measure of my skill level.
29. As a player, I want to install the game as a PWA on my home screen, so that I can return to it quickly like a native app.
30. As a player on iOS or Android, I want the game to prompt me to add it to my home screen at the right moment, so that I can install it without hunting through browser menus.

---

## Implementation Decisions

### Stack

All infrastructure runs on Cloudflare's free tier: Pages (frontend), Workers (API + logic), Durable Objects (real-time game rooms), D1 (database + dictionary), KV (sessions + matchmaking queue).

Frontend is a Next.js static export deployed to Cloudflare Pages. All game logic runs server-side in Workers and Durable Objects — the client is a thin UI layer.

### WordValidator module

Encapsulates all word legality checks behind a single interface: given a candidate word, the required starting letter, and the set of words already played in this round, returns `{ valid: boolean, reason?: string }`. Internally queries D1 (SOWPODS, ~270K words, preloaded as ~1.8 MB) and enforces the chain rule and duplicate check. This module is the authoritative source of truth — the client never validates words independently.

### ScoringEngine module

A pure function with no I/O. Given a word and current game state (chain length, active multipliers), returns `{ points: number, breakdown: { base, rareLetter, longWord } }`. Rare letter bonus: 2× letter value for Q, X, Z, J. Long word bonus: +5 for 8+ letter words. No Danger Zone logic in MVP (that activates at 20+ words in Phase 3).

### MatchStateMachine module

Manages the full lifecycle of a match as an explicit state machine. States: `waiting`, `round_active`, `round_complete`, `match_complete`. Transitions fire on events: `wordSubmitted`, `invalidWord`, `turnTimeout`, `rematchRequested`. Each transition returns the new state plus a list of events to broadcast to both clients. This module is pure — it takes current state + event, returns next state + side effects. The Durable Object drives it but doesn't own the logic.

### TimerController

Owned by the Durable Object. Manages a single active countdown (15 seconds per turn). On expiry, emits a `turnTimeout` event into the MatchStateMachine. The Durable Object's WebSocket hibernation means idle connections cost no CPU; the timer only runs during active turns.

### GameRoom (Durable Object)

One Durable Object per active match. Holds a WebSocket connection for each of the two players. Owns the MatchStateMachine instance and TimerController. Receives messages from clients (word submissions, disconnects), drives the state machine, and broadcasts state updates to both clients. Room ID is a random slug used as both the DO name and the friend invite URL token.

### MatchmakingQueue

Implemented in Workers KV. When a player presses Play, the Worker checks for a waiting player in KV. If one exists, it creates a GameRoom and returns the room ID to both players. If not, it writes the current player's ID to KV and polls (long-poll or client-side retry) until matched. Maximum wait: 30 seconds before returning to idle with a "no opponent found" message.

### ELOCalculator

Pure function: `calculate(winnerElo, loserElo)` → `{ winnerDelta, loserDelta }`. Standard Elo formula, K-factor of 32 for MVP. Applied in a Worker after match completion, written to D1.

### AuthHandler

Workers-based. Anonymous accounts: on first visit, a Worker issues a UUID player ID and signs a JWT stored in a secure HttpOnly cookie. Optional Google/Apple OAuth: standard OAuth 2.0 redirect flow, callback handled in a Worker, linked to the existing anonymous account. JWTs stored and validated via Workers KV. No third-party auth library — custom implementation to stay within free tier.

### D1 Schema (MVP)

- `players`: id, display_name, elo, created_at, linked_oauth_provider
- `matches`: id, player1_id, player2_id, winner_id, round_scores (JSON), created_at
- `match_words`: match_id, round_number, turn_order, word, player_id, points
- `dictionary`: word (indexed) — preloaded SOWPODS list

Match history is capped at the 50 most recent matches per player, enforced at write time.

### Frontend

Three screens for MVP: **Lobby** (Play button, friend invite link generator, recent matches list), **Game** (chain display, turn timer, word input, player score indicators, round tracker), **Result** (final scores, word-by-word replay, rematch button). No routing library required — three views managed by client state. WebSocket connection managed by a single hook.

### PWA

Manifest + service worker via `next-pwa` or equivalent. Offline shell cached; dictionary validation always requires a live connection. Install prompt deferred and shown after match completion to catch players at peak engagement.

---

## Testing Decisions

Good tests verify external behavior through a module's public interface, not internal implementation details. A test should break only when the module's contract changes, not when its internals are refactored.

### Modules to test

**WordValidator** — highest priority. Tests cover: valid word accepted, unknown word rejected, word with wrong starting letter rejected, duplicate word in current round rejected, case-insensitive matching. These tests run against a small in-memory mock dictionary, not D1.

**ScoringEngine** — fully pure, fully testable. Tests cover: base per-letter scoring, rare letter doubling (Q/X/Z/J), long word bonus (exactly 8 letters, 9 letters), combined rare + long word, zero-length edge case.

**MatchStateMachine** — tests cover all state transitions: valid word advances turn, invalid word increments fault counter, third fault ends round, timeout ends round, three round wins end match, match ends mid-round when third round win reached.

**ELOCalculator** — tests cover: equal ELO players (symmetric delta), higher-ELO player wins (smaller gain), lower-ELO player wins (larger gain).

**MatchmakingQueue** — integration test against a KV mock: first player enqueues and waits, second player enqueues and triggers pairing, both receive room ID.

### What not to test in MVP

GameRoom (Durable Object) wiring, AuthHandler OAuth flows, and frontend components are not unit-tested in MVP. The core loop is validated by the five modules above. End-to-end browser testing is out of scope for MVP.

---

## Out of Scope

- Power-ups (any tier) — Phase 1
- Rivalry system — Phase 1
- Friend list and online status — Phase 1
- Daily challenge broadcasts — Phase 1
- Share card image generation — Phase 1
- Word reactions — Phase 1
- XP system and titles — Phase 1
- Achievement badges — Phase 1
- All game modes other than Classic Duel (Speed Round, Theme Battle, King of the Chain, Endless Co-op, Daily Gauntlet) — Phase 2+
- Mutators — Phase 3
- Danger Zone UI and 3× multiplier — Phase 3
- Comeback mechanic (Last Stand) — Phase 3
- Weekend tournaments — Phase 3
- Spectator mode — Phase 2
- Friend leagues — Phase 2
- Visual customization (chain themes, word effects) — Phase 2+
- Monetization — Phase 2+
- Web Push notifications — Phase 1 (except PWA install prompt which ships in MVP)

---

## Further Notes

- The SOWPODS word list (~270K words) must be preloaded into D1 before the game goes live. This is a one-time migration step, not an ongoing operation.
- Anonymous accounts mean zero sign-up friction, but players risk losing their account if they clear cookies. The OAuth link flow exists specifically to prevent this — surface it gently after the first match win.
- Cloudflare Durable Objects require the paid Workers plan for production reliability at scale, but the free tier supports development and low-traffic launch. Monitor daily request counts against the 100K/day limit.
- The 15-second timer lives in the Durable Object, not the client. Client-side countdown is display-only. This prevents timer manipulation and ensures both players see the same state.
- Friend invite links expose the room ID in the URL. Room IDs should be unguessable random slugs (16+ characters), not sequential integers.
