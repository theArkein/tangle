# Tangle UI Redesign + System Design Doc

## Context

The app shipped MVP with a minimal Tailwind/Geist font UI. Two design reference files have been added to `docs/`:
- `ChainBattleDesignSystem.jsx` — full design token system (colors, typography, radii, component library)
- `ChainBattleResponsive.jsx` — responsive prototype with sidebar+bottom-nav layout and all screens

Goal: Upgrade the entire frontend to match the Chain Battle design language. Add Profile and League screens. League stays disabled (coming soon) since that feature is unbuilt. Include a Design System Doc for the project.

Approach chosen: **CSS custom properties + Tailwind** — tokens in `globals.css`, atoms in `frontend/src/components/ui/`, Tailwind utilities for spacing/layout.

Light mode only (no dark mode).

---

## Deliverables

1. `frontend/src/app/globals.css` — full design token CSS vars, Google Fonts import, remove dark mode ✅
2. `frontend/src/app/layout.tsx` — swap Geist fonts for design system fonts, add `AppLayout` shell ✅
3. `frontend/src/components/layout/AppLayout.tsx` — responsive shell: sidebar (desktop ≥900px), collapsed sidebar (tablet 640–900px), bottom nav (mobile <640px) ✅
4. `frontend/src/components/layout/Sidebar.tsx` — fixed left nav, collapsible on tablet ✅
5. `frontend/src/components/layout/BottomNav.tsx` — fixed bottom nav, mobile only ✅
6. `frontend/src/components/ui/Button.tsx` — 5 variants: primary, secondary, accent, ghost, danger ✅
7. `frontend/src/components/ui/Badge.tsx` — 7 variants: neutral, success, danger, warning, info, accent, rare ✅
8. `frontend/src/components/ui/WordPill.tsx` — player1, player2, danger, mystery, neutral ✅
9. `frontend/src/components/ui/Avatar.tsx` — letter avatar, p1/p2 color variants, size prop ✅
10. `frontend/src/components/ui/TimerBar.tsx` — percent + danger mode (red when ≤5s) ✅
11. `frontend/src/components/ui/Card.tsx` — base card wrapper with hover state ✅
12. `frontend/src/app/page.tsx` — Home/lobby redesigned ✅
13. `frontend/src/app/game/page.tsx` — game screen redesigned (mobile + desktop layouts) ✅
14. `frontend/src/app/profile/page.tsx` — NEW: profile screen ✅
15. `frontend/src/app/league/page.tsx` — NEW: league coming-soon screen ✅
16. `docs/DESIGN_SYSTEM.md` — design system document ✅

---

## Design Tokens (globals.css)

```css
/* Neutral scale */
--n0: #FFFFFF; --n50: #FAFAF9; --n100: #F5F5F4; --n200: #E7E5E4;
--n300: #D6D3D1; --n400: #A8A29E; --n500: #78716C; --n600: #57534E;
--n700: #44403C; --n800: #292524; --n900: #1C1917; --n950: #0F0E0D;

/* Accent */
--accent-warm: #C2A67D; --accent-warm-light: #D4BFA0;
--accent-warm-muted: #A8916A; --accent-warm-faint: rgba(194,166,125,0.08);
--accent-warm-subtle: rgba(194,166,125,0.15);

/* Semantic */
--success: #6B8F71; --success-light: rgba(107,143,113,0.12);
--danger: #C07070;  --danger-light: rgba(192,112,112,0.12);
--warning: #C2A24D; --warning-light: rgba(194,162,77,0.12);
--info: #7D9AB5;    --info-light: rgba(125,154,181,0.12);

/* Game */
--p1: #8B9E8B; --p1-light: rgba(139,158,139,0.15);
--p2: #A08B7B; --p2-light: rgba(160,139,123,0.15);
--danger-zone: #C07070; --danger-zone-bg: rgba(192,112,112,0.06);
--rare: #9B8DB5; --rare-bg: rgba(155,141,181,0.1);
--mystery: #B5A87D; --mystery-bg: rgba(181,168,125,0.1);
--freeze: #7D9AB5;

/* Typography */
--font-display: 'DM Serif Display', Georgia, serif;
--font-heading: 'Sora', 'Helvetica Neue', sans-serif;
--font-body: 'IBM Plex Sans', 'Helvetica Neue', sans-serif;
--font-mono: 'IBM Plex Mono', 'Menlo', monospace;

/* Radii */
--radius-sm: 6px; --radius-md: 10px; --radius-lg: 14px;
--radius-xl: 20px; --radius-full: 9999px;
```

Google Fonts import (top of globals.css):
```css
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Sora:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
```

---

## Component API Reference

### Button
```tsx
<Button variant="primary|secondary|accent|ghost|danger" size="sm|md|lg|xl" full icon={node} onClick={fn}>
  label
</Button>
```
Sizes: `sm` 7/14px pad, `md` 11/22px, `lg` 14/28px, `xl` 16/32px. `full` → `width: 100%`.

### Badge
```tsx
<Badge variant="neutral|success|danger|warning|info|accent|rare" size="sm|xs">label</Badge>
```
Pill shape (`border-radius: var(--radius-full)`).

### WordPill
```tsx
<WordPill word="tiger" variant="player1|player2|danger|mystery|neutral" size="sm|md" />
```
Colored pill. `player1` → p1 palette, `player2` → p2 palette.

### Avatar
```tsx
<Avatar name="Sarad" variant="p1|p2|neutral" size={36} />
```
Shows first letter uppercase. Uses `p1-light` bg / `p1` text color. Pass `"?"` for unknown player.

### TimerBar
```tsx
<TimerBar percent={75} danger={timeLeft <= 5} label="8s" />
```
Thin 5px bar. Danger mode: `--danger` color.

### Card
```tsx
<Card onClick={fn} style={{}}>children</Card>
```
`border: 1px solid var(--n200)`, `border-radius: var(--radius-xl)`, white background.

---

## Navigation Shell

### AppLayout (`components/layout/AppLayout.tsx`)
- Self-fetches `/api/me` for player data (ELO display in sidebar)
- Mobile (`< 640px`): renders `BottomNav`, children full viewport
- Tablet (`640–900px`): renders `Sidebar` with `collapsed={true}` (64px wide, icons only)
- Desktop (`≥ 900px`): renders `Sidebar` with `collapsed={false}` (220px wide)
- Content offset by sidebar width (marginLeft)
- Skips nav for `/game` routes — game is fullscreen

### Nav items
| Icon | Label | Route | Status |
|------|-------|-------|--------|
| 🏠 | Home | `/` | Active |
| 👤 | Profile | `/profile` | Active |
| 🏅 | League | `/league` | Disabled (opacity 0.35, no click) |

Shared nav item config: `frontend/src/components/layout/navItems.ts`

---

## Screen Designs

### Home / Lobby (`app/page.tsx`)
All fetch/matchmaking logic unchanged. JSX replaced:
- "Chain Battle" heading in `var(--font-display)`
- `Button` primary for Play, secondary for Challenge a friend
- `Card` wrapper for recent matches with `Badge` W/L indicators
- Waiting: spin animation, `Button ghost` cancel

### Game Screen (`app/game/page.tsx`)
All WebSocket/timer logic unchanged. JSX replaced:
- `Avatar` for each player (own name from `/api/me`, opponent shows "?")
- `TimerBar` → `percent={timeLeft / TURN_SECONDS * 100}`, `danger={timerUrgent}`
- Word chain as `WordPill` grid (player1/player2 variant by playerId)
- 3 fault dots: filled `--danger` / empty `--n200`
- `Button primary` for submit
- Desktop: right sidebar with power-ups "Coming soon"

### Profile (`app/profile/page.tsx`) — NEW
Data: `/api/me` + `/api/me/matches`
- Large `Avatar` (52px), name in `var(--font-display)`, ELO in `var(--font-mono)`
- 3 stat boxes: ELO, matches count, win rate
- Recent matches list with `Avatar` per opponent
- Badges section: "Coming soon" with dashed border

### League (`app/league/page.tsx`) — NEW, DISABLED
- 🏅 icon + "Leagues" heading + "Coming soon" message
- Nav item disabled at 35% opacity

---

## Implementation Order

1. ✅ `globals.css` — design tokens + Google Fonts
2. ✅ `ui/` components — Button, Badge, WordPill, Avatar, TimerBar, Card
3. ✅ `layout/` components — AppLayout, Sidebar, BottomNav, navItems
4. ✅ `layout.tsx` — swap fonts, wrap with AppLayout
5. ✅ `app/page.tsx` — rebuild lobby JSX
6. ✅ `app/game/page.tsx` — rebuild game JSX
7. ✅ `app/profile/page.tsx` — new screen
8. ✅ `app/league/page.tsx` — new coming-soon screen
9. ✅ `docs/DESIGN_SYSTEM.md` — design system document

---

## Verification

1. `cd frontend && npm run type-check` — must pass with 0 errors
2. `npm run lint` — must pass
3. `npm run build` — static export must succeed
4. Manual test — `npm run dev`:
   - Lobby: Play, Challenge a friend, recent matches render correctly
   - Matchmaking spinner appears
   - Profile page: loads with ELO and win stats
   - League page: coming-soon screen, nav item disabled/greyed
   - Sidebar on desktop, collapsed on tablet, bottom nav on mobile
   - `/game?room=test` loads without crashing
5. `npm test` from root — 64/64 worker tests pass (no backend changes)

---

## Key Decisions

- **Inline styles over Tailwind classes** for components — keeps token fidelity without complex Tailwind config
- **AppLayout self-fetches `/api/me`** — static export means layout.tsx (Server Component) can't do runtime fetches
- **Hydration fix**: `windowWidth` initializes as `undefined`, renders `{children}` only until after first effect fires — prevents SSR/client layout mismatch
- **League nav item**: `<button disabled>` (not a link) — correct semantics, keyboard unreachable, 35% opacity
- **Opponent avatar in game**: shows "?" — no opponent name lookup endpoint yet (future: add `playerNames` map to `state_update` WS message)
