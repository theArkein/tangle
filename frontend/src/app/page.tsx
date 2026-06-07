'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'

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
type GameMode = 'classic' | 'speed_round'

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
  const [player, setPlayer] = useState<PlayerInfo | null>(null)
  const [recentMatches, setRecentMatches] = useState<RecentMatch[] | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [token, setToken] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [mode, setMode] = useState<GameMode>('classic')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('game_mode') : null
    if (stored === 'speed_round' || stored === 'classic') setMode(stored)
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
          router.push(`/game/?room=${body.roomId}`)
        } else if (body.status === 'timeout') {
          // Token expired — drop back to idle so the user can re-queue.
          clearInterval(pollRef.current!)
          setPhase('idle')
          setToken(null)
        }
      } catch {}
    }, 2000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [phase, token, router])

  async function handlePlay() {
    const res = await fetch('/api/matchmake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    })
    const body = (await res.json()) as { status: string; token?: string; roomId?: string }
    if (body.status === 'matched' && body.roomId) {
      router.push(`/game/?room=${body.roomId}`)
    } else if (body.token) {
      setToken(body.token)
      setPhase('waiting')
    }
  }

  function handleCancel() {
    setPhase('idle')
    setToken(null)
  }

  async function handleChallengeFriend() {
    const res = await fetch('/api/rooms', { method: 'POST' })
    const { roomId } = (await res.json()) as { roomId: string }
    const url = `${window.location.origin}/game?room=${roomId}`
    await navigator.clipboard.writeText(url)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 3000)
  }

  return (
    <div className="flex flex-col min-h-full">
      {phase === 'idle' && (
        <div style={{ padding: '24px 20px', maxWidth: 480, margin: '0 auto' }}>
          {/* Title + subtitle */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--n900)', margin: 0, lineHeight: 1.2 }}>
              Chain Battle
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--n400)', marginTop: 6 }}>
              Build the longest word chain to win
            </p>
          </div>

          {/* Mode picker */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'var(--n400)', marginBottom: 6 }}>
              Game mode
            </div>
            <div role="tablist" style={{ display: 'flex', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--n200)' }}>
              {([
                { id: 'classic', label: 'Classic', subtitle: '60s · best of 5 · power-ups' },
                { id: 'speed_round', label: 'Speed', subtitle: '8s · single round · no power-ups' },
              ] as const).map(opt => {
                const active = mode === opt.id
                return (
                  <button
                    key={opt.id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => selectMode(opt.id)}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      background: active ? 'var(--n900)' : 'var(--n0)',
                      color: active ? 'var(--n0)' : 'var(--n700)',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-heading)',
                      borderRight: opt.id === 'classic' ? '1px solid var(--n200)' : 'none',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{opt.label}</div>
                    <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{opt.subtitle}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
            <Button variant="primary" size="lg" full onClick={handlePlay}>Play</Button>
            <Button variant="secondary" size="md" full onClick={handleChallengeFriend}>
              {linkCopied ? 'Link copied!' : 'Challenge a friend'}
            </Button>
          </div>

          {/* Recent matches label */}
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'var(--n400)', fontFamily: 'var(--font-body)' }}>
              Recent matches
            </span>
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
            <Card style={{ padding: '32px 20px', textAlign: 'center' as const }}>
              <p style={{ fontSize: 13, color: 'var(--n400)', fontFamily: 'var(--font-body)' }}>No matches yet</p>
            </Card>
          )}

          {/* Match list */}
          {recentMatches !== null && recentMatches.length > 0 && (
            <Card>
              {recentMatches.map((m, i) => (
                <div key={m.id} style={{ display:'flex', alignItems:'center', padding:'10px 14px', gap:10, borderBottom: i < recentMatches.length - 1 ? '1px solid var(--n100)' : 'none' }}>
                  <Badge variant={m.outcome === 'win' ? 'success' : 'danger'}>
                    {m.outcome === 'win' ? 'W' : 'L'}
                  </Badge>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:13, fontWeight:500, fontFamily:'var(--font-heading)', color:'var(--n900)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>
                      {m.opponent}
                    </p>
                    <p style={{ fontSize:11, color:'var(--n400)', fontFamily:'var(--font-body)', margin:0 }}>
                      {relativeTime(m.date)}
                    </p>
                  </div>
                  <span style={{ fontSize:13, fontFamily:'var(--font-mono)', color:'var(--n600)', whiteSpace:'nowrap' as const }}>
                    {m.roundScores[0]}–{m.roundScores[1]}
                  </span>
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
              <a href="/api/auth/google" style={{ fontSize:12, fontWeight:600, color:'var(--accent-warm-muted)', fontFamily:'var(--font-body)', textDecoration:'none', whiteSpace:'nowrap' as const }}>
                Link Google →
              </a>
            </div>
          )}
        </div>
      )}

      {phase === 'waiting' && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'60vh', textAlign:'center' as const, padding:24, gap:20 }}>
          <div style={{ width:72, height:72, borderRadius:'var(--radius-full)', border:'3px solid var(--n200)', borderTopColor:'var(--n900)', animation:'spin 1s linear infinite' }} />
          <div>
            <p style={{ fontFamily:'var(--font-display)', fontSize:22, color:'var(--n900)', margin:0 }}>Finding {mode === 'speed_round' ? 'Speed' : 'Classic'} opponent…</p>
            <p style={{ fontSize:13, color:'var(--n400)', fontFamily:'var(--font-body)', marginTop:6 }}>Players in the other mode won&apos;t match with you</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleCancel}>Cancel</Button>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  )
}
