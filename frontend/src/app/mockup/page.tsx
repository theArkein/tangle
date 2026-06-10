'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'

type GameMode = 'classic' | 'speed_round'
type Screen = 'lobby' | 'waiting'
type HeaderVariant = 'A' | 'B' | 'C'

const MODES = {
  classic: { label: 'Classic', detail: 'Best of 5 · 15s turns · power-ups' },
  speed_round: { label: 'Speed', detail: 'Single round · 8s turns · no power-ups' },
}

const MOCK_MATCHES = [
  { id: '1', opponent: 'Priya', outcome: 'win' as const, roundScores: [3, 1] as [number, number], ago: '2h ago' },
  { id: '2', opponent: 'Marcus', outcome: 'loss' as const, roundScores: [1, 3] as [number, number], ago: '5h ago' },
  { id: '3', opponent: 'Yuki', outcome: 'win' as const, roundScores: [3, 2] as [number, number], ago: '1d ago' },
]

// ─── Header variants ──────────────────────────────────────────────────────────

function HeaderA() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
      <Avatar name="Sarad" variant="p1" size={44} />
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--n900)', margin: 0, lineHeight: 1.2 }}>
          Sarad
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--n400)' }}>ELO</span>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--n700)', fontWeight: 600 }}>1,280</span>
          <span style={{ fontSize: 11, color: 'var(--success)', fontFamily: 'var(--font-mono)', background: 'rgba(107,143,113,0.1)', padding: '1px 6px', borderRadius: 'var(--radius-full)' }}>+12</span>
        </div>
      </div>
    </div>
  )
}

function HeaderB() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--n100)' }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--n900)', margin: 0, lineHeight: 1.1 }}>
          Tangle
        </h1>
        <p style={{ fontSize: 11, fontFamily: 'var(--font-body)', color: 'var(--n400)', margin: '3px 0 0', letterSpacing: '0.01em' }}>
          Word chain battle
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--n0)', border: '1px solid var(--n200)', borderRadius: 'var(--radius-full)', padding: '5px 12px 5px 5px' }}>
        <Avatar name="Sarad" variant="p1" size={28} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-heading)', color: 'var(--n800)', lineHeight: 1.2 }}>Sarad</div>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--n400)' }}>ELO 1,280</div>
        </div>
      </div>
    </div>
  )
}

function HeaderC() {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--n900)', margin: 0 }}>
          Hey, Sarad 👋
        </h1>
        <Avatar name="Sarad" variant="p1" size={38} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { label: 'ELO', value: '1,280', sub: '+12', subColor: 'var(--success)' },
          { label: 'Wins', value: '142', sub: null },
          { label: 'Streak', value: '🔥 7', sub: null },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: 'var(--n0)', border: '1px solid var(--n200)', borderRadius: 'var(--radius-lg)', padding: '10px 12px' }}>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--n900)', lineHeight: 1 }}>
              {s.value}
              {s.sub && <span style={{ fontSize: 10, color: s.subColor ?? '', fontWeight: 500, marginLeft: 4 }}>{s.sub}</span>}
            </div>
            <div style={{ fontSize: 10, color: 'var(--n400)', fontFamily: 'var(--font-body)', marginTop: 4, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Lobby ────────────────────────────────────────────────────────────────────

function LobbyScreen({ onPlay, hasMatches, headerVariant }: { onPlay: () => void; hasMatches: boolean; headerVariant: HeaderVariant }) {
  const [mode, setMode] = useState<GameMode>('classic')
  const [linkCopied, setLinkCopied] = useState(false)
  const matches = hasMatches ? MOCK_MATCHES : []

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden', padding: '0 20px', maxWidth: 480, margin: '0 auto', boxSizing: 'border-box' as const }}>
      <div style={{ flexShrink: 0, paddingTop: 20 }}>
        {headerVariant === 'A' && <HeaderA />}
        {headerVariant === 'B' && <HeaderB />}
        {headerVariant === 'C' && <HeaderC />}

        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', background: 'var(--n100)', borderRadius: 'var(--radius-full)', padding: 3, gap: 2 }}>
            {(['classic', 'speed_round'] as GameMode[]).map(m => {
              const active = mode === m
              return (
                <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-full)', background: active ? 'var(--n0)' : 'transparent', color: active ? 'var(--n900)' : 'var(--n500)', border: active ? '1px solid var(--n200)' : '1px solid transparent', fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s', boxShadow: active ? '0 1px 3px rgba(0,0,0,0.07)' : 'none' }}>
                  {MODES[m].label}
                </button>
              )
            })}
          </div>
          <p style={{ fontSize: 11, color: 'var(--n400)', fontFamily: 'var(--font-body)', margin: '5px 0 0 4px' }}>{MODES[mode].detail}</p>
        </div>

        <div style={{ marginBottom: 8 }}>
          <Button variant="primary" size="xl" full onClick={onPlay}>Play now</Button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <Button variant="secondary" size="md" full icon={<span>👥</span>} onClick={() => setLinkCopied(l => !l)}>
            {linkCopied ? 'Link copied!' : 'Friend'}
          </Button>
          <Button variant="secondary" size="md" full icon={<span>🤖</span>}>vs Bot</Button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'var(--n400)', fontFamily: 'var(--font-body)' }}>Recent matches</span>
          {matches.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--n400)', fontFamily: 'var(--font-body)' }}>
              {matches.filter(m => m.outcome === 'win').length}W · {matches.filter(m => m.outcome === 'loss').length}L
            </span>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' as const, overflowX: 'hidden' as const, paddingBottom: 16 }}>
        {matches.length === 0 ? (
          <Card style={{ padding: '28px 20px', textAlign: 'center' as const }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⚔️</div>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--n700)', fontFamily: 'var(--font-heading)', margin: '0 0 4px' }}>No matches yet</p>
            <p style={{ fontSize: 12, color: 'var(--n400)', fontFamily: 'var(--font-body)', margin: '0 0 16px' }}>Your match history will appear here after your first game.</p>
            <a href="/guide" style={{ fontSize: 12, color: 'var(--n900)', fontFamily: 'var(--font-body)', fontWeight: 500, textDecoration: 'none' }}>New here? How to play →</a>
          </Card>
        ) : (
          <>
            <Card>
              {matches.map((m, i) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', padding: '11px 14px', gap: 10, borderBottom: i < matches.length - 1 ? '1px solid var(--n100)' : 'none' }}>
                  <Avatar name={m.opponent} variant="p2" size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-heading)', color: 'var(--n800)', margin: 0 }}>vs {m.opponent}</p>
                    <p style={{ fontSize: 11, color: 'var(--n400)', fontFamily: 'var(--font-mono)', margin: 0 }}>{m.ago}</p>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--n700)', minWidth: 28, textAlign: 'right' as const }}>{m.roundScores[0]}–{m.roundScores[1]}</span>
                  <Badge variant={m.outcome === 'win' ? 'success' : 'danger'}>{m.outcome === 'win' ? 'W' : 'L'}</Badge>
                </div>
              ))}
            </Card>
            <div style={{ marginTop: 12, textAlign: 'center' as const }}>
              <a href="/guide" style={{ fontSize: 12, color: 'var(--n400)', fontFamily: 'var(--font-body)', textDecoration: 'none' }}>
                New here? <span style={{ color: 'var(--n700)', fontWeight: 500 }}>How to play →</span>
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Waiting ──────────────────────────────────────────────────────────────────

function WaitingScreen({ mode, onCancel }: { mode: GameMode; onCancel: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', height: '100%', padding: '24px 20px', textAlign: 'center' as const, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 32, marginBottom: 32 }}>
        <div style={{ textAlign: 'center' as const }}>
          <Avatar name="Sarad" variant="p1" size={56} />
          <p style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-heading)', color: 'var(--n800)', margin: '8px 0 2px' }}>You</p>
          <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--n400)', margin: 0 }}>1,280</p>
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--n300)', fontFamily: 'var(--font-heading)', letterSpacing: '0.05em' }}>VS</span>
        <div style={{ textAlign: 'center' as const }}>
          <div style={{ position: 'relative' as const, width: 56, height: 56, margin: '0 auto' }}>
            <div style={{ position: 'absolute' as const, inset: 0, borderRadius: 'var(--radius-full)', background: 'var(--p1-light)', animation: 'ping 1.4s cubic-bezier(0,0,0.2,1) infinite', opacity: 0.5 }} />
            <div style={{ position: 'relative' as const, width: 56, height: 56, borderRadius: 'var(--radius-full)', background: 'var(--n100)', border: '2px dashed var(--n300)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'var(--n400)' }}>?</div>
          </div>
          <p style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-heading)', color: 'var(--n400)', margin: '8px 0 2px' }}>Searching</p>
          <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--n300)', margin: 0 }}>±200 ELO</p>
        </div>
      </div>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--n900)', margin: '0 0 6px' }}>Finding opponent…</p>
      <p style={{ fontSize: 12, color: 'var(--n400)', fontFamily: 'var(--font-body)', margin: '0 0 28px' }}>{MODES[mode].label} · {MODES[mode].detail}</p>
      <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      <style>{`@keyframes ping { 75%, 100% { transform: scale(1.6); opacity: 0; } }`}</style>
    </div>
  )
}

// ─── Mockup shell ─────────────────────────────────────────────────────────────

export default function MockupPage() {
  const [screen, setScreen] = useState<Screen>('lobby')
  const [hasMatches, setHasMatches] = useState(true)
  const [headerVariant, setHeaderVariant] = useState<HeaderVariant>('C')

  return (
    <div style={{ height: '100dvh', overflow: 'hidden', background: 'var(--n50)', fontFamily: 'var(--font-body)', color: 'var(--n800)' }}>

      {/* ── Dev controls ── */}
      <div style={{ position: 'fixed' as const, top: 0, left: 0, right: 0, zIndex: 9999, background: 'rgba(28,25,23,0.93)', backdropFilter: 'blur(8px)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto' as const, overflowY: 'hidden' as const, flexWrap: 'nowrap' as const }}>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#78716c', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginRight: 2 }}>Mockup</span>
        <div style={{ width: 1, height: 14, background: '#44403c' }} />

        {(['lobby', 'waiting'] as Screen[]).map(s => (
          <button key={s} onClick={() => setScreen(s)} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: screen === s ? '#e7e5e4' : '#78716c', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', textTransform: 'capitalize' as const }}>
            {s}
          </button>
        ))}

        <div style={{ width: 1, height: 14, background: '#44403c' }} />

        {screen === 'lobby' && (
          <>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#57534e' }}>header:</span>
            {(['A', 'B', 'C'] as HeaderVariant[]).map(v => (
              <button key={v} onClick={() => setHeaderVariant(v)} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: headerVariant === v ? '#e7e5e4' : '#78716c', background: headerVariant === v ? '#292524' : 'none', border: `1px solid ${headerVariant === v ? '#57534e' : 'transparent'}`, borderRadius: 4, cursor: 'pointer', padding: '2px 8px' }}>
                {v}
              </button>
            ))}
            <div style={{ width: 1, height: 14, background: '#44403c' }} />
            <button onClick={() => setHasMatches(h => !h)} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#78716c', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>
              {hasMatches ? 'empty state' : 'with matches'}
            </button>
            <div style={{ width: 1, height: 14, background: '#44403c' }} />
          </>
        )}

        <div style={{ flex: 1 }} />
        <a href="/" style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#57534e', textDecoration: 'none' }}>← current</a>
      </div>

      {/* ── Content ── */}
      <div style={{ marginTop: 40, height: 'calc(100dvh - 40px)', overflow: 'hidden' }}>
        {screen === 'lobby' && <LobbyScreen onPlay={() => setScreen('waiting')} hasMatches={hasMatches} headerVariant={headerVariant} />}
        {screen === 'waiting' && <WaitingScreen mode="classic" onCancel={() => setScreen('lobby')} />}
      </div>

      {/* ── Mock bottom nav ── */}
      <div style={{ position: 'fixed' as const, bottom: 0, left: 0, right: 0, background: 'var(--n0)', borderTop: '1px solid var(--n200)', display: 'flex', justifyContent: 'space-around', padding: '6px 0 12px', zIndex: 100 }}>
        {[{ label: 'Home', icon: '🏠', active: true }, { label: 'Profile', icon: '👤', active: false }, { label: 'Guide', icon: '📖', active: false }, { label: 'League', icon: '🏅', active: false, disabled: true }].map(item => (
          <button key={item.label} style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: (item as { disabled?: boolean }).disabled ? 'default' : 'pointer', padding: '4px 12px', opacity: (item as { disabled?: boolean }).disabled ? 0.35 : 1 }}>
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-body)', fontWeight: item.active ? 600 : 400, color: item.active ? 'var(--n900)' : 'var(--n400)' }}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
