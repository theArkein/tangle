'use client'

import { useState, useRef } from 'react'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import WordPill from '@/components/ui/WordPill'
import TimerBar from '@/components/ui/TimerBar'
import GameToast, { type ToastVariant, TOAST_DURATION } from '@/components/ui/GameToast'
import { POWER_UP_LABELS, type PowerUpId } from '@/lib/powerups'

type GameMode = 'duel' | 'classic'
type Screen = 'lobby' | 'waiting' | 'game' | 'toasts'
type HeaderVariant = 'A' | 'B' | 'C'
type GameSubState = 'my_turn' | 'opp_turn' | 'danger' | 'round_end' | 'match_end'

const MODES = {
  duel: { label: 'Duel', detail: 'Best of 5 · 25s turns · power-ups' },
  classic: { label: 'Classic', detail: 'Single round · 8s turns · no power-ups' },
}

const MOCK_MATCHES = [
  { id: '1', opponent: 'Priya', outcome: 'win' as const, roundScores: [3, 1] as [number, number], ago: '2h ago' },
  { id: '2', opponent: 'Marcus', outcome: 'loss' as const, roundScores: [1, 3] as [number, number], ago: '5h ago' },
  { id: '3', opponent: 'Yuki', outcome: 'win' as const, roundScores: [3, 2] as [number, number], ago: '1d ago' },
]

const MOCK_CHAIN = ['tangent', 'entice', 'iceberg', 'ergot', 'gothic', 'icicle', 'clever']
const MOCK_MY_INV: Partial<Record<PowerUpId, number>> = { freeze: 2, secondLife: 1, wild: 1 }
const MOCK_OPP_INV: Partial<Record<PowerUpId, number>> = { letterBomb: 1, double: 2 }

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
            {(['duel', 'classic'] as GameMode[]).map(m => {
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

// ─── Game ─────────────────────────────────────────────────────────────────────

function GameScreen({ subState }: { subState: GameSubState; activeToastVariant: ToastVariant | null }) {
  const [powerNotifs, setPowerNotifs] = useState<Array<{ id: number; emoji: string; title: string; desc: string; byMe: boolean }>>([])
  const notifIdRef = useRef(0)
  const [toast, setToast] = useState<{ id: number; variant: ToastVariant } | null>(null)
  const toastIdRef = useRef(0)

  const inDangerZone = subState === 'danger'
  const isMyTurn = subState === 'my_turn' || subState === 'danger'
  const myWins = 2
  const oppWins = 1
  const myScore = 47
  const oppScore = 31
  const timerPct = subState === 'danger' ? 40 : isMyTurn ? 70 : 100
  const timerUrgent = subState === 'danger'
  const chain = MOCK_CHAIN
  const lastWord = chain[chain.length - 1]
  const nextSeed = lastWord ? lastWord.slice(-1).toUpperCase() : 'T'

  function triggerNotif(byMe: boolean) {
    const id = ++notifIdRef.current
    const emoji = byMe ? '❄️' : '💣'
    const title = byMe ? 'You picked up Freeze' : 'Opponent activated Letter Bomb'
    const desc = byMe ? "Pause your opponent's timer for 5 seconds." : 'Your next word may need to contain Q, X, Z, or J.'
    setPowerNotifs(prev => [...prev, { id, emoji, title, desc, byMe }])
    setTimeout(() => setPowerNotifs(prev => prev.filter(n => n.id !== id)), 2500)
  }

  function triggerToast(variant: ToastVariant) {
    const id = ++toastIdRef.current
    setToast({ id, variant })
    setTimeout(() => setToast(t => t?.id === id ? null : t), TOAST_DURATION)
  }

  if (subState === 'round_end') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column' as const, height: '100%', justifyContent: 'center', alignItems: 'center', padding: 20, background: 'var(--n50)' }}>
        <div style={{ width: '100%', maxWidth: 420, background: 'var(--n0)', border: '1px solid var(--n200)', borderRadius: 'var(--radius-xl)', padding: '28px 24px', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--n400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Round 2 complete</p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--n900)', marginBottom: 4 }}>You won the round!</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
            {[1, 2, 3, 4, 5].map(r => {
              const myWon = r <= 2
              const oppWon = r === 1 && false
              const isCurrent = r === 2
              return (
                <div key={r} style={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)', background: myWon ? 'var(--p1-light)' : oppWon ? 'var(--p2-light)' : 'var(--n100)', color: myWon ? 'var(--p1)' : oppWon ? 'var(--p2)' : 'var(--n400)', border: `1px solid ${isCurrent ? 'var(--p1)' : 'transparent'}`, opacity: r > 2 ? 0.4 : 1 }}>
                  {r <= 2 ? 'W' : r}
                </div>
              )
            })}
          </div>
          <Button variant="primary" size="lg" full>Play Again</Button>
          <Button variant="secondary" size="lg" full>Back to Lobby</Button>
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--n500)' }}>Waiting on opponent… <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--n400)' }}>12s</span></div>
        </div>
        <style>{`@keyframes notifFade { 0% { opacity: 0; transform: translateY(-4px); } 15% { opacity: 1; transform: translateY(0); } 85% { opacity: 1; } 100% { opacity: 0; } }`}</style>
      </div>
    )
  }

  if (subState === 'match_end') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column' as const, height: '100%', justifyContent: 'center', alignItems: 'center', padding: 20, background: 'var(--n50)' }}>
        <div style={{ width: '100%', maxWidth: 420, background: 'var(--n0)', border: '1px solid var(--n200)', borderRadius: 'var(--radius-xl)', padding: '28px 24px', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🏆</div>
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--n400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Match complete</p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--n900)', marginBottom: 16 }}>You won!</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 20 }}>
            <div style={{ textAlign: 'center' as const }}>
              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--p1)' }}>3</div>
              <div style={{ fontSize: 10, color: 'var(--n400)', fontFamily: 'var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>You</div>
            </div>
            <div style={{ fontSize: 20, color: 'var(--n300)', alignSelf: 'center' as const, fontFamily: 'var(--font-mono)' }}>–</div>
            <div style={{ textAlign: 'center' as const }}>
              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--p2)' }}>1</div>
              <div style={{ fontSize: 10, color: 'var(--n400)', fontFamily: 'var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>Priya</div>
            </div>
          </div>
          <div style={{ background: 'var(--n50)', borderRadius: 'var(--radius-lg)', padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ textAlign: 'center' as const }}>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--n900)' }}>+14</div>
              <div style={{ fontSize: 10, color: 'var(--n400)', fontFamily: 'var(--font-body)', marginTop: 2 }}>ELO change</div>
            </div>
            <div style={{ textAlign: 'center' as const }}>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--n900)' }}>142</div>
              <div style={{ fontSize: 10, color: 'var(--n400)', fontFamily: 'var(--font-body)', marginTop: 2 }}>Total words</div>
            </div>
            <div style={{ textAlign: 'center' as const }}>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--n900)' }}>1,294</div>
              <div style={{ fontSize: 10, color: 'var(--n400)', fontFamily: 'var(--font-body)', marginTop: 2 }}>New ELO</div>
            </div>
          </div>
          <Button variant="primary" size="lg" full>Rematch</Button>
          <Button variant="secondary" size="lg" full>Back to Lobby</Button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' as const, height: '100%', overflow: 'hidden' }}>

      {/* Game header */}
      <div style={{ background: 'var(--n0)', borderBottom: '1px solid var(--n200)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--n400)', padding: '4px', lineHeight: 1 }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-heading)', color: 'var(--n900)' }}>Classic Duel</div>
          <div style={{ fontSize: 11, color: 'var(--n400)', fontFamily: 'var(--font-mono)' }}>Round 2</div>
        </div>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 4, lineHeight: 1, color: 'var(--n400)', opacity: 0.7 }}>🔊</button>
      </div>

      {/* Danger Zone strip */}
      {inDangerZone && (
        <div style={{ background: 'var(--danger-zone-bg)', borderBottom: '1px solid var(--danger-zone)', padding: '6px 14px', fontSize: 11, color: 'var(--danger-zone)', textAlign: 'center', flexShrink: 0, fontWeight: 700, letterSpacing: '0.04em' }}>
          DANGER ZONE — 3× scoring · 5s timer
        </div>
      )}

      {/* Notification overlay — power notifs + toast, centered top */}
      {(powerNotifs.length > 0 || toast) && (
        <div style={{ position: 'fixed', top: 12, left: 0, right: 0, zIndex: 60, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '0 14px' }}>
          {powerNotifs.map(n => (
            <div key={n.id} style={{ background: 'var(--n800)', color: 'var(--n0)', padding: '6px 10px 6px 8px', borderRadius: 'var(--radius-md)', borderLeft: `7px solid ${n.byMe ? 'var(--p1)' : 'var(--p2)'}`, animation: 'notifFade 2.5s ease-out forwards', maxWidth: 260, width: '100%', display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'auto' }}>
              <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{n.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-heading)', lineHeight: 1.2, color: n.byMe ? 'var(--p1)' : 'var(--p2)' }}>{n.title}</div>
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2, fontFamily: 'var(--font-body)', lineHeight: 1.3 }}>{n.desc}</div>
              </div>
              <button onClick={() => setPowerNotifs(prev => prev.filter(p => p.id !== n.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: 11, lineHeight: 1, color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>✕</button>
            </div>
          ))}
          {toast && (
            <div style={{ pointerEvents: 'auto', width: '100%', maxWidth: 260 }}>
              <GameToast key={toast.id} variant={toast.variant} onDismiss={() => setToast(null)} />
            </div>
          )}
        </div>
      )}

      {/* Players row */}
      <div style={{ background: 'var(--n0)', borderBottom: '1px solid var(--n100)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Avatar name="You" variant="p1" size={30} />
            {isMyTurn && <div style={{ position: 'absolute', bottom: -2, right: -2, width: 9, height: 9, borderRadius: '50%', background: 'var(--p1)', border: '2px solid var(--n0)' }} />}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-heading)', color: 'var(--n800)', margin: '0 0 2px' }}>
              You {isMyTurn && <span style={{ color: 'var(--p1)', fontWeight: 500 }}>· your turn</span>}
            </p>
            <div style={{ margin: '0 0 3px' }}>
              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--p1)' }}>{myScore}</span>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--n800)', lineHeight: 1 }}>{myWins} – {oppWins}</div>
          <div style={{ fontSize: 9, color: 'var(--n400)', letterSpacing: '0.06em', fontWeight: 600, marginTop: 2 }}>ROUNDS</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
          <div style={{ minWidth: 0, flex: 1, textAlign: 'right' }}>
            <p style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-heading)', color: 'var(--n800)', margin: '0 0 2px' }}>
              {!isMyTurn && <span style={{ color: 'var(--p2)', fontWeight: 500 }}>thinking… · </span>}Priya
            </p>
            <div style={{ margin: '0 0 3px', textAlign: 'right' }}>
              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--p2)' }}>{oppScore}</span>
            </div>
          </div>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Avatar name="Priya" variant="p2" size={30} />
            {!isMyTurn && <div style={{ position: 'absolute', bottom: -2, right: -2, width: 9, height: 9, borderRadius: '50%', background: 'var(--p2)', border: '2px solid var(--n0)' }} />}
          </div>
        </div>
      </div>

      {/* Power-ups row */}
      <div style={{ background: 'var(--n50)', borderBottom: '1px solid var(--n100)', padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 4, flex: 1, flexWrap: 'wrap' as const }}>
          {(Object.keys(POWER_UP_LABELS) as PowerUpId[]).map(id => {
            const count = MOCK_MY_INV[id] ?? 0
            return (
              <span key={id} title={POWER_UP_LABELS[id].name}
                style={{ fontSize: 11, opacity: count > 0 ? 1 : 0.15, lineHeight: 1.2, position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 1, padding: '1px 2px' }}>
                {POWER_UP_LABELS[id].emoji}
                {count > 0 && <span style={{ fontSize: 7, fontFamily: 'var(--font-mono)', color: 'var(--p1)', fontWeight: 700, lineHeight: 1 }}>{count}</span>}
              </span>
            )
          })}
        </div>
        <span style={{ fontSize: 9, color: 'var(--n300)', fontFamily: 'var(--font-mono)', fontWeight: 600, flexShrink: 0 }}>PWR</span>
        <div style={{ display: 'flex', gap: 4, flex: 1, flexWrap: 'wrap' as const, justifyContent: 'flex-end' }}>
          {(Object.keys(POWER_UP_LABELS) as PowerUpId[]).map(id => {
            const count = MOCK_OPP_INV[id] ?? 0
            return (
              <span key={id} title={POWER_UP_LABELS[id].name}
                style={{ fontSize: 11, opacity: count > 0 ? 1 : 0.15, lineHeight: 1.2, position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 1, padding: '1px 2px' }}>
                {POWER_UP_LABELS[id].emoji}
                {count > 0 && <span style={{ fontSize: 7, fontFamily: 'var(--font-mono)', color: 'var(--p2)', fontWeight: 700, lineHeight: 1 }}>{count}</span>}
              </span>
            )
          })}
        </div>
      </div>

      {/* Chain area */}
      <div style={{ flex: 1, padding: '12px 16px 52px', display: 'flex', flexWrap: 'wrap' as const, gap: 6, alignContent: 'flex-start', overflow: 'hidden', position: 'relative' }}>
        {chain.map((word, i) => (
          <WordPill key={i} word={word} variant={i % 2 === 0 ? 'player1' : 'player2'} size="sm" />
        ))}
        {!isMyTurn && (
          <span style={{ fontSize: 12, color: 'var(--n400)', fontFamily: 'var(--font-mono)', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'var(--n100)', borderRadius: 'var(--radius-full)', border: '1px dashed var(--n300)' }}>
            er<span style={{ animation: 'blink 1s step-end infinite', opacity: 0.5 }}>|</span>
          </span>
        )}

        {/* Reaction FAB */}
        <div style={{ position: 'absolute', bottom: 58, right: 14 }}>
          <button style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--n0)', border: '1px solid var(--n200)', boxShadow: '0 2px 8px rgba(0,0,0,0.10)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            😊
          </button>
        </div>

        {/* Powers strip */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--n0)', borderTop: '1px solid var(--n100)', padding: '6px 10px', display: 'flex', gap: 4, alignItems: 'center', overflowX: 'auto' } as React.CSSProperties}>
          {(Object.keys(POWER_UP_LABELS) as PowerUpId[]).map(id => {
            const count = MOCK_MY_INV[id] ?? 0
            const earned = count > 0
            return (
              <button key={id} disabled={!earned}
                style={{ position: 'relative', background: 'none', border: 'none', padding: '2px 3px', cursor: earned ? 'pointer' : 'default', opacity: earned ? 1 : 0.2, filter: earned ? 'none' : 'grayscale(1)', flexShrink: 0 }}>
                <span style={{ fontSize: 22, lineHeight: 1 }}>{POWER_UP_LABELS[id].emoji}</span>
                {earned && (
                  <span style={{ position: 'absolute', top: 0, right: 0, fontSize: 8, fontFamily: 'var(--font-mono)', background: 'var(--p1)', color: 'var(--n0)', borderRadius: '99px', padding: '1px 3px', fontWeight: 700, lineHeight: 1 }}>×{count}</span>
                )}
              </button>
            )
          })}
        </div>

        <style>{`
          @keyframes blink { 50% { opacity: 0; } }
          @keyframes notifFade { 0% { opacity: 0; transform: translateY(-4px); } 15% { opacity: 1; transform: translateY(0); } 85% { opacity: 1; } 100% { opacity: 0; } }
          @keyframes scoreFloat { 0% { opacity: 0; transform: translateY(0); } 15% { opacity: 1; transform: translateY(-8px); } 100% { opacity: 0; transform: translateY(-60px); } }
        `}</style>
      </div>

      {/* Bottom panel */}
      <div style={{ background: 'var(--n0)', borderTop: `1px solid ${inDangerZone ? 'var(--danger-zone)' : 'var(--n200)'}`, padding: '10px 14px 20px', flexShrink: 0 }}>
        <div style={{ marginBottom: 10 }}>
          <TimerBar percent={timerPct} danger={timerUrgent} label={isMyTurn ? (inDangerZone ? '4s' : '11s') : '15s'} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          {isMyTurn ? (
            <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-heading)', color: inDangerZone ? 'var(--danger-zone)' : 'var(--p1)' }}>
              Word starting with <strong>{nextSeed}</strong>
            </span>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--n400)', fontFamily: 'var(--font-body)' }}>Waiting for opponent…</span>
          )}
          <span style={{ fontSize: 11, color: 'var(--n400)', fontFamily: 'var(--font-mono)' }}>{chain.length} words</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ flex: 1, height: 40, border: '1.5px solid var(--n300)', borderRadius: 'var(--radius-md)', background: isMyTurn ? 'var(--n0)' : 'var(--n50)', display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: 13, color: isMyTurn ? 'var(--n900)' : 'var(--n400)', fontFamily: 'var(--font-body)', opacity: isMyTurn ? 1 : 0.5 }}>
            {isMyTurn ? <span>er<span style={{ animation: 'blink 1s step-end infinite', opacity: 0.5 }}>|</span></span> : 'Waiting…'}
          </div>
          <button style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: isMyTurn ? 'var(--n900)' : 'var(--n200)', border: 'none', color: isMyTurn ? 'var(--n0)' : 'var(--n400)', fontSize: 16, cursor: isMyTurn ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>→</button>
        </div>
      </div>

      {/* Dev actions row — accessible via data attribute for dev bar */}
      <div id="game-dev-actions" style={{ display: 'none' }} data-trigger-notif-me="true" data-trigger-notif-opp="true" data-trigger-toast="true"
        data-on-trigger-notif-me={() => triggerNotif(true)}
        data-on-trigger-notif-opp={() => triggerNotif(false)}
      />

      {/* Expose trigger fns via ref pattern — we pass them up via a sneaky approach */}
      <GameTriggerBridge triggerNotif={triggerNotif} triggerToast={triggerToast} />
    </div>
  )
}

// Bridge component to pass trigger functions up to the parent via callback
function GameTriggerBridge({ triggerNotif, triggerToast }: { triggerNotif: (byMe: boolean) => void; triggerToast: (v: ToastVariant) => void }) {
  // Register on the window for parent access
  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__mockupGameTriggers = { triggerNotif, triggerToast }
  }
  return null
}

// ─── Toasts catalogue ─────────────────────────────────────────────────────────

const ALL_TOAST_VARIANTS: ToastVariant[] = ['error', 'success', 'badge', 'danger_zone', 'time_warn']

function ToastsScreen() {
  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px 20px', maxWidth: 480, margin: '0 auto', boxSizing: 'border-box' as const }}>
      <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'var(--n400)', fontFamily: 'var(--font-body)', margin: '0 0 16px' }}>Toast variants</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ALL_TOAST_VARIANTS.map(variant => (
          <div key={variant}>
            <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--n400)', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{variant}</p>
            <GameToast variant={variant} />
          </div>
        ))}
      </div>
      <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'var(--n400)', fontFamily: 'var(--font-body)', margin: '28px 0 16px' }}>Power notif pills</p>
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, maxWidth: 260 }}>
        <div>
          <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--n400)', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>mine — p1 border</p>
          <div style={{ background: 'var(--n800)', color: 'var(--n0)', padding: '6px 10px 6px 8px', borderRadius: 'var(--radius-md)', borderLeft: '7px solid var(--p1)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>❄️</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-heading)', lineHeight: 1.2, color: 'var(--p1)' }}>You picked up Freeze</div>
              <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2, fontFamily: 'var(--font-body)', lineHeight: 1.3 }}>Pause your opponent&apos;s timer for 5 seconds.</div>
            </div>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: 11, lineHeight: 1, color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>✕</button>
          </div>
        </div>
        <div>
          <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--n400)', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>opponent — p2 border</p>
          <div style={{ background: 'var(--n800)', color: 'var(--n0)', padding: '6px 10px 6px 8px', borderRadius: 'var(--radius-md)', borderLeft: '7px solid var(--p2)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>💣</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-heading)', lineHeight: 1.2, color: 'var(--p2)' }}>Opponent activated Letter Bomb</div>
              <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2, fontFamily: 'var(--font-body)', lineHeight: 1.3 }}>Your next word may need to contain Q, X, Z, or J.</div>
            </div>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: 11, lineHeight: 1, color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>✕</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Mockup shell ─────────────────────────────────────────────────────────────

export default function MockupPage() {
  const [screen, setScreen] = useState<Screen>('lobby')
  const [hasMatches, setHasMatches] = useState(true)
  const [headerVariant, setHeaderVariant] = useState<HeaderVariant>('C')
  const [gameSubState, setGameSubState] = useState<GameSubState>('my_turn')
  const [activeToastVariant] = useState<ToastVariant | null>(null)

  function triggerGameNotif(byMe: boolean) {
    const triggers = (typeof window !== 'undefined') ? (window as unknown as Record<string, unknown>).__mockupGameTriggers as { triggerNotif: (b: boolean) => void; triggerToast: (v: ToastVariant) => void } | undefined : undefined
    triggers?.triggerNotif(byMe)
  }

  function triggerGameToast(variant: ToastVariant) {
    const triggers = (typeof window !== 'undefined') ? (window as unknown as Record<string, unknown>).__mockupGameTriggers as { triggerNotif: (b: boolean) => void; triggerToast: (v: ToastVariant) => void } | undefined : undefined
    triggers?.triggerToast(variant)
  }

  const GAME_SUB_STATES: GameSubState[] = ['my_turn', 'opp_turn', 'danger', 'round_end', 'match_end']

  return (
    <div style={{ height: '100dvh', overflow: 'hidden', background: 'var(--n50)', fontFamily: 'var(--font-body)', color: 'var(--n800)' }}>

      {/* ── Dev controls ── */}
      <div style={{ position: 'fixed' as const, top: 0, left: 0, right: 0, zIndex: 9999, background: 'rgba(28,25,23,0.93)', backdropFilter: 'blur(8px)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto' as const, overflowY: 'hidden' as const, flexWrap: 'nowrap' as const }}>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#78716c', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginRight: 2 }}>Mockup</span>
        <div style={{ width: 1, height: 14, background: '#44403c' }} />

        {(['lobby', 'waiting', 'game', 'toasts'] as Screen[]).map(s => (
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

        {screen === 'game' && (
          <>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#57534e' }}>state:</span>
            {GAME_SUB_STATES.map(s => (
              <button key={s} onClick={() => setGameSubState(s)} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: gameSubState === s ? '#e7e5e4' : '#78716c', background: gameSubState === s ? '#292524' : 'none', border: `1px solid ${gameSubState === s ? '#57534e' : 'transparent'}`, borderRadius: 4, cursor: 'pointer', padding: '2px 8px', whiteSpace: 'nowrap' as const }}>
                {s}
              </button>
            ))}
            <div style={{ width: 1, height: 14, background: '#44403c' }} />
            <button onClick={() => triggerGameNotif(true)} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#78716c', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', whiteSpace: 'nowrap' as const }}>
              notif me
            </button>
            <button onClick={() => triggerGameNotif(false)} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#78716c', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', whiteSpace: 'nowrap' as const }}>
              notif opp
            </button>
            <div style={{ width: 1, height: 14, background: '#44403c' }} />
            {ALL_TOAST_VARIANTS.map(v => (
              <button key={v} onClick={() => triggerGameToast(v)} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#78716c', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', whiteSpace: 'nowrap' as const }}>
                {v}
              </button>
            ))}
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
        {screen === 'game' && <GameScreen subState={gameSubState} activeToastVariant={activeToastVariant} />}
        {screen === 'toasts' && <ToastsScreen />}
      </div>

      {/* ── Mock bottom nav (lobby/waiting only) ── */}
      {(screen === 'lobby' || screen === 'waiting') && (
        <div style={{ position: 'fixed' as const, bottom: 0, left: 0, right: 0, background: 'var(--n0)', borderTop: '1px solid var(--n200)', display: 'flex', justifyContent: 'space-around', padding: '6px 0 12px', zIndex: 100 }}>
          {[{ label: 'Home', icon: '🏠', active: true }, { label: 'Profile', icon: '👤', active: false }, { label: 'Guide', icon: '📖', active: false }, { label: 'League', icon: '🏅', active: false, disabled: true }].map(item => (
            <button key={item.label} style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: (item as { disabled?: boolean }).disabled ? 'default' : 'pointer', padding: '4px 12px', opacity: (item as { disabled?: boolean }).disabled ? 0.35 : 1 }}>
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-body)', fontWeight: item.active ? 600 : 400, color: item.active ? 'var(--n900)' : 'var(--n400)' }}>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
