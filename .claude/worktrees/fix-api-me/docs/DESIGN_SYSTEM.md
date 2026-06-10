# Tangle Design System

Based on the Chain Battle design language. Light mode only.

---

## Typography

| Role | Font | Fallback |
|------|------|----------|
| Display (headings, titles) | DM Serif Display | Georgia, serif |
| Heading (UI labels, nav) | Sora | Helvetica Neue, sans-serif |
| Body (paragraphs, inputs) | IBM Plex Sans | Helvetica Neue, sans-serif |
| Mono (scores, ELO, code) | IBM Plex Mono | Menlo, monospace |

Loaded via Google Fonts in `globals.css`. CSS vars: `--font-display`, `--font-heading`, `--font-body`, `--font-mono`.

---

## Color Tokens

### Neutral Scale
| Token | Value | Use |
|-------|-------|-----|
| `--n0` | `#FFFFFF` | Card backgrounds, modals |
| `--n50` | `#FAFAF9` | Page background |
| `--n100` | `#F5F5F4` | Hover states, subtle fills |
| `--n200` | `#E7E5E4` | Borders, dividers |
| `--n300` | `#D6D3D1` | Disabled borders |
| `--n400` | `#A8A29E` | Placeholder text, muted labels |
| `--n500` | `#78716C` | Secondary text |
| `--n600` | `#57534E` | Ghost button text |
| `--n700` | `#44403C` | Secondary foreground |
| `--n800` | `#292524` | Primary body text |
| `--n900` | `#1C1917` | Headings, primary button bg |
| `--n950` | `#0F0E0D` | Rarely used |

### Accent (Warm Gold)
| Token | Value | Use |
|-------|-------|-----|
| `--accent-warm` | `#C2A67D` | Accent button, progress fill |
| `--accent-warm-light` | `#D4BFA0` | Accent borders |
| `--accent-warm-muted` | `#A8916A` | Accent text |
| `--accent-warm-faint` | `rgba(194,166,125,0.08)` | Accent card background |
| `--accent-warm-subtle` | `rgba(194,166,125,0.15)` | Hover on accent |

### Semantic
| Token | Value |
|-------|-------|
| `--success` / `--success-light` | `#6B8F71` / `rgba(107,143,113,0.12)` |
| `--danger` / `--danger-light` | `#C07070` / `rgba(192,112,112,0.12)` |
| `--warning` / `--warning-light` | `#C2A24D` / `rgba(194,162,77,0.12)` |
| `--info` / `--info-light` | `#7D9AB5` / `rgba(125,154,181,0.12)` |

### Game-specific
| Token | Value | Use |
|-------|-------|-----|
| `--p1` / `--p1-light` | `#8B9E8B` / `rgba(139,158,139,0.15)` | Player 1 (you) |
| `--p2` / `--p2-light` | `#A08B7B` / `rgba(160,139,123,0.15)` | Player 2 (opponent) |
| `--danger-zone` / `--danger-zone-bg` | `#C07070` / `rgba(192,112,112,0.06)` | Danger Zone timer |
| `--rare` / `--rare-bg` | `#9B8DB5` / `rgba(155,141,181,0.1)` | Rare letter bonus |
| `--mystery` / `--mystery-bg` | `#B5A87D` / `rgba(181,168,125,0.1)` | Mystery words |
| `--freeze` | `#7D9AB5` | Freeze power-up |

---

## Border Radius

| Token | Value | Use |
|-------|-------|-----|
| `--radius-sm` | `6px` | Tags, small badges |
| `--radius-md` | `10px` | Buttons, inputs |
| `--radius-lg` | `14px` | Cards (inner), panels |
| `--radius-xl` | `20px` | Cards, modals |
| `--radius-full` | `9999px` | Pills, avatars, badges |

---

## Component API

### Button
```tsx
import Button from '@/components/ui/Button'

<Button variant="primary" size="md" full icon={<span>▶</span>} onClick={fn}>
  Play now
</Button>
```

| Prop | Type | Default | Values |
|------|------|---------|--------|
| `variant` | string | `primary` | `primary` `secondary` `accent` `ghost` `danger` |
| `size` | string | `md` | `sm` `md` `lg` `xl` |
| `full` | boolean | `false` | Expands to 100% width |
| `icon` | ReactNode | — | Rendered before children |
| `disabled` | boolean | `false` | Reduces opacity to 40% |

### Badge
```tsx
import Badge from '@/components/ui/Badge'

<Badge variant="success" size="sm">Victory</Badge>
```

| Variant | Use |
|---------|-----|
| `neutral` | Default labels |
| `success` | Wins, positive outcomes |
| `danger` | Losses, errors |
| `warning` | Caution states |
| `info` | Informational |
| `accent` | Featured / highlighted |
| `rare` | Rare letter bonus |

### WordPill
```tsx
import WordPill from '@/components/ui/WordPill'

<WordPill word="tiger" variant="player1" size="md" />
```

Variants: `player1` (green), `player2` (brown), `danger` (red), `mystery` (gold), `neutral` (grey).

### Avatar
```tsx
import Avatar from '@/components/ui/Avatar'

<Avatar name="Sarad" variant="p1" size={36} />
```

Pass `name="?"` for unknown players. `size` is the diameter in pixels (default `36`).

### TimerBar
```tsx
import TimerBar from '@/components/ui/TimerBar'

<TimerBar percent={75} danger={timeLeft <= 5} label="8s" />
```

`percent` is 0–100. `danger={true}` turns the bar red. `label` is optional right-side text.

### Card
```tsx
import Card from '@/components/ui/Card'

<Card onClick={fn} style={{ padding: '16px' }}>
  content
</Card>
```

Hover state activates border darkening only when `onClick` is provided.

---

## Navigation Shell

`AppLayout` wraps all pages except `/game`. It self-fetches `/api/me` for the sidebar ELO display.

| Breakpoint | Layout |
|-----------|--------|
| `< 640px` (mobile) | Bottom navigation bar, full-width content |
| `640–900px` (tablet) | 64px collapsed sidebar (icons only) |
| `≥ 900px` (desktop) | 220px sidebar with labels |

Game routes (`/game*`) bypass the nav shell entirely for fullscreen layout.

### Nav items
| Route | Label | Status |
|-------|-------|--------|
| `/` | Home | Active |
| `/profile` | Profile | Active |
| `/league` | League | Disabled (coming soon) |

---

## Spacing Conventions

- Page content padding: `16px` mobile, `28px 36px` desktop (handled by `AppLayout`)
- Mobile bottom padding: `60px` (accounts for bottom nav)
- Card internal padding: `12–24px` depending on density
- Section gap between major blocks: `16–24px`
- Inline gap within a row: `8–12px`

---

## Implementation Notes

- **Inline styles over Tailwind** for components — preserves token fidelity without complex config overrides.
- **`globals.css`** holds all CSS custom property definitions and the Google Fonts `@import`.
- **Hydration safety**: `AppLayout` initializes `windowWidth` as `undefined`, renders only `children` until the first client effect fires, preventing SSR/client layout mismatch.
- **League nav item**: rendered as `<button disabled>` — semantically unreachable, 35% opacity.
- **Opponent avatar in game**: shows `"?"` — no opponent name in the WebSocket state yet.
