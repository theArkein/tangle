'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'
import { useSoundEngine } from '@/hooks/useSoundEngine'

interface PlayerInfo {
  id: string
  display_name: string
  elo: number
  google_linked: boolean
}

interface RecentMatch {
  id: string
  opponent: string
  outcome: 'win' | 'loss'
  roundScores: [number, number]
  date: number
}

type Phase = 'idle' | 'waiting'
type GameMode = 'duel' | 'classic'

const MODES: Record<GameMode, { label: string; detail: string }> = {
  duel:    { label: 'Duel',    detail: '25s turns · power-ups' },
  classic: { label: 'Classic', detail: 'Single round · 8s turns · no power-ups' },
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export default function LobbyPage() {
  const router = useRouter()
  const { play, muted, setMuted } = useSoundEngine()
  const [player, setPlayer] = useState<PlayerInfo | null>(null)
  const [recentMatches, setRecentMatches] = useState<RecentMatch[] | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [token, setToken] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [mode, setMode] = useState<GameMode>(() => {
    if (typeof window === 'undefined') return 'duel'
    const stored = localStorage.getItem('game_mode')
    return (stored === 'duel' || stored === 'classic') ? stored : 'duel'
  })
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json())
      .then(data => setPlayer(data as PlayerInfo))
      .catch(() => {})
    fetch('/api/me/matches')
      .then(r => r.json())
      .then(data => setRecentMatches(data as RecentMatch[]))
      .catch(() => setRecentMatches([]))
  }, [])

  function selectMode(next: GameMode) {
    setMode(next)
    play('tap')
    if (typeof window !== 'undefined') localStorage.setItem('game_mode', next)
  }

  useEffect(() => {
    if (phase !== 'waiting' || !token) {
      if (pollRef.current) clearInterval(pollRef.current)
      return
    }
    const t = token
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/matchmake/${t}`)
        if (!res.ok) return
        const body = (await res.json()) as { status: string; roomId?: string }
        if (body.status === 'matched' && body.roomId) {
          clearInterval(pollRef.current!)
          play('turn_start')
          router.push(`/game/?room=${body.roomId}`)
        } else if (body.status === 'timeout') {
          clearInterval(pollRef.current!)
          setPhase('idle')
          setToken(null)
        }
      } catch {}
    }, 2000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [phase, token, router, play])

  async function handlePlay() {
    play('tap')
    const res = await fetch('/api/matchmake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    })
    const body = (await res.json()) as { status: string; token?: string; roomId?: string }
    if (body.status === 'matched' && body.roomId) {
      play('turn_start')
      router.push(`/game/?room=${body.roomId}`)
    } else if (body.token) {
      setToken(body.token)
      setPhase('waiting')
    }
  }

  function handleCancel() {
    play('tap')
    setPhase('idle')
    setToken(null)
  }

  async function handlePlayVsBot() {
    play('tap')
    const res = await fetch('/api/rooms/vs-bot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    })
    const body = (await res.json()) as { roomId?: string }
    if (body.roomId) router.push(`/game/?room=${body.roomId}`)
  }

  async function handleChallengeFriend() {
    play('tap')
    const res = await fetch('/api/rooms', { method: 'POST' })
    const { roomId } = (await res.json()) as { roomId: string }
    const url = `${window.location.origin}/game?room=${roomId}`
    await navigator.clipboard.writeText(url)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 3000)
  }

  const wins = recentMatches ? recentMatches.filter(m => m.outcome === 'win').length : null

  // ── Waiting screen ────────────────────────────────────────────────────────

  if (phase === 'waiting') {
    return (
      <div style={{ height: '100dvh', overflow: 'hidden', background: 'var(--n50)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32, marginBottom: 32 }}>
          {/* Me */}
          <div style={{ textAlign: 'center' }}>
            {player ? (
              <Avatar name={player.display_name} variant="p1" size={56} />
            ) : (
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--n200)' }} />
            )}
            <p style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-heading)', color: 'var(--n800)', margin: '8px 0 2px' }}>You</p>
            <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--n400)', margin: 0 }}>{player ? player.elo : '—'}</p>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--n300)', fontFamily: 'var(--font-heading)', letterSpacing: '0.05em' }}>VS</span>
          {/* Searching */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ position: 'relative', width: 56, height: 56, margin: '0 auto' }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--p1-light)', animation: 'ping 1.4s cubic-bezier(0,0,0.2,1) infinite', opacity: 0.5 }} />
              <div style={{ position: 'relative', width: 56, height: 56, borderRadius: '50%', background: 'var(--n100)', border: '2px dashed var(--n300)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'var(--n400)' }}>?</div>
            </div>
            <p style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-heading)', color: 'var(--n400)', margin: '8px 0 2px' }}>Searching</p>
            <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--n300)', margin: 0 }}>±200 ELO</p>
          </div>
        </div>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--n900)', margin: '0 0 6px' }}>Finding opponent…</p>
        <p style={{ fontSize: 12, color: 'var(--n400)', fontFamily: 'var(--font-body)', margin: '0 0 28px' }}>
          {MODES[mode].label} · {MODES[mode].detail}
        </p>
        <Button variant="ghost" size="sm" onClick={handleCancel}>Cancel</Button>
        <style>{`@keyframes ping { 75%, 100% { transform: scale(1.6); opacity: 0; } }`}</style>
      </div>
    )
  }

  // ── Idle / lobby screen ───────────────────────────────────────────────────

  return (
    <div style={{ height: '100dvh', overflow: 'hidden', background: 'var(--n50)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto', width: '100%', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ padding: '20px 20px 32px' }}>

          {/* ── Header ── */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--n900)', margin: 0, lineHeight: 1.2 }}>
                {player ? `Hey, ${player.display_name} 👋` : 'Chain Battle'}
              </h1>
              <p style={{ fontSize: 12, color: 'var(--n400)', fontFamily: 'var(--font-body)', marginTop: 4, marginBottom: 0 }}>
                Ready to battle?
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setMuted(!muted)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: '4px', lineHeight: 1, color: 'var(--n400)' }}
                title={muted ? 'Unmute sounds' : 'Mute sounds'}
              >
                {muted ? '🔇' : '🔊'}
              </button>
              {player && <Avatar name={player.display_name} variant="p1" size={38} />}
            </div>
          </div>

          {/* ── Stat mini-cards ── */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {[
              { label: 'ELO', value: player ? String(player.elo) : '—' },
              { label: 'Wins', value: wins !== null ? String(wins) : '—' },
              { label: 'Streak', value: '🔥' },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: 'var(--n0)', border: '1px solid var(--n200)', borderRadius: 'var(--radius-lg)', padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--n900)', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--n400)', fontFamily: 'var(--font-body)', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── Mode picker ── */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', background: 'var(--n100)', borderRadius: 'var(--radius-full)', padding: 3, gap: 2 }}>
              {(Object.entries(MODES) as [GameMode, { label: string; detail: string }][]).map(([id, cfg]) => {
                const active = mode === id
                return (
                  <button
                    key={id}
                    onClick={() => selectMode(id)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-full)',
                      background: active ? 'var(--n0)' : 'transparent',
                      color: active ? 'var(--n900)' : 'var(--n500)',
                      border: active ? '1px solid var(--n200)' : '1px solid transparent',
                      fontFamily: 'var(--font-heading)',
                      fontSize: 13,
                      fontWeight: active ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      boxShadow: active ? '0 1px 3px rgba(0,0,0,0.07)' : 'none',
                    }}
                  >
                    {cfg.label}
                  </button>
                )
              })}
            </div>
            <p style={{ fontSize: 11, color: 'var(--n400)', fontFamily: 'var(--font-body)', margin: '5px 0 0 4px' }}>
              {MODES[mode].detail}
            </p>
          </div>

          {/* ── CTAs ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12, marginTop: 16 }}>
            <Button variant="primary" size="lg" full onClick={handlePlay}>Play now</Button>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary" size="md" full onClick={handleChallengeFriend}>
                {linkCopied ? 'Link copied!' : 'Friend'}
              </Button>
              <Button variant="secondary" size="md" full onClick={handlePlayVsBot}>
                vs Bot
              </Button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <Link href="/guide" style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--n500)', textDecoration: 'none', padding: '4px 8px' }}>
              New here? <span style={{ color: 'var(--n900)', fontWeight: 500 }}>How to play →</span>
            </Link>
          </div>

          {/* ── Recent matches ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--n400)', fontFamily: 'var(--font-body)' }}>
              Recent matches
            </span>
            {recentMatches && recentMatches.length > 0 && (
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--n500)' }}>
                {wins}W · {recentMatches.length - (wins ?? 0)}L
              </span>
            )}
          </div>

          {/* Loading skeleton */}
          {recentMatches === null && (
            <Card>
              {[0,1,2].map(i => (
                <div key={i} style={{ display:'flex', alignItems:'center', padding:'10px 14px', gap:10, borderBottom: i < 2 ? '1px solid var(--n100)' : 'none' }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--n200)' }} />
                  <div style={{ flex:1 }}>
                    <div style={{ height:12, width:80, background:'var(--n200)', borderRadius:'var(--radius-sm)', marginBottom:4 }} />
                    <div style={{ height:10, width:48, background:'var(--n100)', borderRadius:'var(--radius-sm)' }} />
                  </div>
                  <div style={{ height:12, width:28, background:'var(--n200)', borderRadius:'var(--radius-sm)' }} />
                </div>
              ))}
            </Card>
          )}

          {/* Empty state */}
          {recentMatches !== null && recentMatches.length === 0 && (
            <Card style={{ padding: '32px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>⚔️</div>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--n700)', fontFamily: 'var(--font-heading)', margin: 0 }}>No matches yet</p>
              <p style={{ fontSize: 12, color: 'var(--n400)', fontFamily: 'var(--font-body)', margin: '4px 0 0' }}>
                Hit <strong>Play now</strong> to start your first game
              </p>
            </Card>
          )}

          {/* Match list */}
          {recentMatches !== null && recentMatches.length > 0 && (
            <Card>
              {recentMatches.map((m, i) => (
                <div key={m.id} style={{ display:'flex', alignItems:'center', padding:'10px 14px', gap:10, borderBottom: i < recentMatches.length - 1 ? '1px solid var(--n100)' : 'none' }}>
                  <Avatar name={m.opponent} variant="p2" size={28} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:13, fontWeight:500, fontFamily:'var(--font-heading)', color:'var(--n900)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      vs {m.opponent}
                    </p>
                    <p style={{ fontSize:11, color:'var(--n400)', fontFamily:'var(--font-body)', margin:0 }}>
                      {relativeTime(m.date)}
                    </p>
                  </div>
                  <span style={{ fontSize:12, fontFamily:'var(--font-mono)', color:'var(--n600)', whiteSpace:'nowrap', marginRight: 6 }}>
                    {m.roundScores[0]}–{m.roundScores[1]}
                  </span>
                  <Badge variant={m.outcome === 'win' ? 'success' : 'danger'}>
                    {m.outcome === 'win' ? 'W' : 'L'}
                  </Badge>
                </div>
              ))}
            </Card>
          )}

          {/* Google link prompt */}
          {player && !player.google_linked && (
            <div style={{ marginTop:16, padding:'12px 14px', background:'var(--accent-warm-faint)', border:'1px solid var(--accent-warm-subtle)', borderRadius:'var(--radius-lg)', display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:13, fontWeight:500, color:'var(--n800)', margin:0, fontFamily:'var(--font-heading)' }}>Save your progress</p>
                <p style={{ fontSize:11, color:'var(--n500)', margin:0, fontFamily:'var(--font-body)' }}>Link Google to keep your account</p>
              </div>
              <a href="/api/auth/google" style={{ fontSize:12, fontWeight:600, color:'var(--accent-warm-muted)', fontFamily:'var(--font-body)', textDecoration:'none', whiteSpace:'nowrap' }}>
                Link Google →
              </a>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
