# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tangle is a real-time 2-player word chain game built on Cloudflare's stack. Players must submit words that start with the last letter of the previous word, with turn timers, scoring, and ELO-based matchmaking.

## Commands

### Worker (root)
```bash
npm run dev          # Start local Wrangler dev server on port 8787
npm test             # Run all vitest tests
npm run test:watch   # Run tests in watch mode
npm run type-check   # TypeScript type check (no emit)
npm run deploy       # Deploy worker to Cloudflare
npm run db:migrate   # Apply D1 migrations locally
```

### Frontend (`frontend/`)
```bash
npm run dev          # Start Next.js dev server
npm run build        # Build static export to frontend/out/
npm run type-check   # TypeScript type check
npm run lint         # ESLint
```

Run a single test file: `npx vitest run tests/GameRoom.test.ts`

## Architecture

**Backend:** Cloudflare Workers (TypeScript, port 8787) serving both the API and the static frontend from `/frontend/out/`.

**Frontend:** Next.js with `output: "export"` (static). Deployed as Worker assets, not a standalone server.

**Real-time:** Cloudflare Durable Objects for stateful WebSocket game sessions — one `GameRoom` DO instance per active match.

### Request Flow

1. `POST /api/matchmake` → queues player, returns poll token
2. `GET /api/matchmake/{token}` → poll until match found, returns `roomId`
3. Frontend opens WebSocket to `/api/rooms/{roomId}/ws` (JWT as Bearer in Sec-WebSocket-Protocol)
4. `GameRoom` DO handles all game state, word validation, scoring, and persistence

### Key Files

- `src/index.ts` — Worker entry point, routes, WebSocket upgrade
- `src/durable-objects/GameRoom.ts` — Stateful game session (WebSocket, timers, state transitions)
- `src/modules/MatchStateMachine.ts` — Turn-based state machine (waiting → round_active → round_complete → match_complete)
- `src/modules/WordValidator.ts` — D1 dictionary lookup
- `src/modules/ScoringEngine.ts` — Per-word point calculation (base + rare letter bonus + long word bonus + danger zone 3× multiplier)
- `src/modules/EloCalculator.ts` — ELO rating updates post-match
- `src/modules/MatchPersistence.ts` — D1 writes for match results
- `src/auth/middleware.ts` — JWT Bearer extraction; sets trusted `X-Player-Id` header internally
- `src/routes/oauth.ts` — Google OAuth flow
- `frontend/src/app/page.tsx` — Lobby (matchmaking, recent matches)
- `frontend/src/app/game/page.tsx` — In-game WebSocket client

### Database (D1 SQLite)

```
players(id, display_name, elo, created_at, linked_oauth_provider)
matches(id, player1_id, player2_id, winner_id, round_scores, created_at)
match_words(id, match_id, round_number, turn_order, word, player_id, points)
dictionary(word PRIMARY KEY)  -- ~270K SOWPODS words
```

Migrations live in `/migrations/`. Apply locally with `npm run db:migrate`.

### Game Rules (from product spec)

- Best of 5 rounds; first to win 3 rounds wins the match
- 15-second turn timer; 5-second "Danger Zone" timer when chain reaches 20+ words
- Danger Zone awards 3× points
- Word must start with the last 2 letters of the previous word

## Testing

Tests use `@cloudflare/vitest-pool-workers` to run inside the Workers runtime. The test wrangler config is `wrangler.test.toml` (no assets directory). 10 test files cover: ELO, GameRoom, state machine, scoring, auth, matchmaking, OAuth.

## CI/CD

GitHub Actions (`.github/workflows/deploy.yml`):
- **PRs to main:** type-check + vitest (worker and frontend)
- **Push to main:** tests pass → `next build` → `wrangler deploy`
- Requires secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

## Frontend Note

The frontend uses a version of Next.js with breaking changes from prior versions. Before writing frontend code, consult `frontend/node_modules/next/dist/docs/` for current APIs and conventions.
