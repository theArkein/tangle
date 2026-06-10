'use client'

import { useEffect, useState } from 'react'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'

interface PlayerData {
  id: string
  display_name: string
  elo: number
  google_linked: boolean
  xp: number
  total_wins: number
  title: string
  next_title: string | null
  wins_to_next_title: number | null
}

interface MatchRecord {
  id: string
  opponent: string
  outcome: 'win' | 'loss'
  roundScores: [number, number]
  date: number
}

// Title thresholds — mirrored from src/modules/TitleEngine.ts
const TITLE_THRESHOLDS: Record<string, number> = {
  Apprentice: 0,
  'Word Slinger': 10,
  'Chain Forger': 50,
  Wordsmith: 200,
  'Chain Lord': 500,
  Lexicon: 1000,
}

function titleProgressPercent(p: PlayerData): number {
  if (!p.next_title) return 100
  const currentThreshold = TITLE_THRESHOLDS[p.title] ?? 0
  const nextThreshold = TITLE_THRESHOLDS[p.next_title] ?? p.total_wins + (p.wins_to_next_title ?? 1)
  const span = Math.max(1, nextThreshold - currentThreshold)
  const into = p.total_wins - currentThreshold
  return Math.max(0, Math.min(100, (into / span) * 100))
}

export default function ProfilePage() {
  const [player, setPlayer] = useState<PlayerData | null>(null)
  const [matches, setMatches] = useState<MatchRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/me').then(r => r.json()),
      fetch('/api/me/matches').then(r => r.json()).catch(() => []),
    ]).then(([me, matchList]) => {
      setPlayer(me as PlayerData)
      setMatches((matchList as MatchRecord[]) ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function saveName() {
    if (!player) return
    setNameError(null)
    setSaving(true)
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: nameInput }),
      })
      if (!res.ok) {
        setNameError(await res.text())
        return
      }
      const data = await res.json() as { display_name: string }
      setPlayer(p => p ? { ...p, display_name: data.display_name } : p)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ width: 28, height: 28, border: '3px solid var(--n200)', borderTopColor: 'var(--n900)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!player) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--n400)' }}>
        Could not load profile
      </div>
    )
  }

  const wins = matches.filter(m => m.outcome === 'win').length
  const winRate = matches.length > 0 ? Math.round((wins / matches.length) * 100) : 0

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 4px' }}>
      {/* Profile card */}
      <Card style={{ padding: '24px 20px', marginBottom: '16px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
          <Avatar name={player.display_name} variant="p1" size={52} />
        </div>

        {/* Name row */}
        {editing ? (
          <div style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <input
                value={nameInput}
                onChange={e => { setNameInput(e.target.value); setNameError(null) }}
                maxLength={24}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditing(false) }}
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '18px',
                  color: 'var(--n900)',
                  border: '1.5px solid var(--n300)',
                  borderRadius: 'var(--radius-md)',
                  padding: '4px 10px',
                  background: 'var(--n0)',
                  outline: 'none',
                  width: '180px',
                  textAlign: 'center',
                }}
              />
              <Button variant="primary" size="sm" onClick={saveName} disabled={saving}>
                {saving ? '…' : 'Save'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setNameError(null) }}>
                Cancel
              </Button>
            </div>
            {nameError && (
              <div style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '6px' }}>{nameError}</div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--n900)' }}>
              {player.display_name}
            </div>
            {player.google_linked && (
              <button
                onClick={() => { setNameInput(player.display_name); setEditing(true) }}
                title="Rename"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--n400)',
                  padding: '3px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: 'var(--radius-sm)',
                  lineHeight: 1,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <Badge variant="info">{player.title}</Badge>
          <Badge variant="neutral">
            <span style={{ fontFamily: 'var(--font-mono)' }}>ELO {player.elo}</span>
          </Badge>
          {player.google_linked && (
            <Badge variant="success">Google linked</Badge>
          )}
        </div>

        {/* Title progress */}
        {player.next_title && player.wins_to_next_title !== null && (
          <div style={{ marginTop: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--n400)', marginBottom: '4px' }}>
              <span>Progress to {player.next_title}</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{player.wins_to_next_title} wins to go</span>
            </div>
            <div style={{ height: '6px', background: 'var(--n100)', borderRadius: '3px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${titleProgressPercent(player)}%`,
                  background: 'var(--accent-warm-muted)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Stat boxes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
        {[
          { label: 'XP', value: String(player.xp) },
          { label: 'Wins', value: String(player.total_wins) },
          { label: 'Win rate', value: matches.length > 0 ? `${winRate}%` : '—' },
        ].map(stat => (
          <Card key={stat.label} style={{ padding: '14px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'var(--font-heading)', color: 'var(--n900)', marginBottom: '4px' }}>
              {stat.value}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--n400)' }}>{stat.label}</div>
          </Card>
        ))}
      </div>

      {/* Recent matches */}
      <div style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--n400)', marginBottom: '8px' }}>
        Recent matches
      </div>
      {matches.length === 0 ? (
        <Card style={{ padding: '24px', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: 'var(--n400)' }}>No matches yet — play your first game!</p>
        </Card>
      ) : (
        <Card style={{ overflow: 'hidden' }}>
          {matches.map((match, i) => (
            <div
              key={match.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 16px',
                borderBottom: i < matches.length - 1 ? '1px solid var(--n100)' : 'none',
              }}
            >
              <Avatar name={match.opponent || '?'} variant="p2" size={30} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-heading)', color: 'var(--n800)' }}>
                  vs {match.opponent}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--n400)', fontFamily: 'var(--font-mono)', marginTop: '1px' }}>
                  {match.roundScores[0]} – {match.roundScores[1]} pts
                  {match.date ? ` · ${new Date(match.date).toLocaleDateString()}` : ''}
                </div>
              </div>
              <Badge variant={match.outcome === 'win' ? 'success' : 'danger'}>
                {match.outcome === 'win' ? 'Victory' : 'Defeat'}
              </Badge>
            </div>
          ))}
        </Card>
      )}

      {/* Badges — coming soon */}
      <div style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--n400)', margin: '24px 0 8px' }}>
        Badges
      </div>
      <div style={{ border: '1.5px dashed var(--n200)', borderRadius: 'var(--radius-xl)', padding: '28px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '24px', marginBottom: '8px' }}>🏅</div>
        <div style={{ fontSize: '14px', fontWeight: 500, fontFamily: 'var(--font-heading)', color: 'var(--n700)', marginBottom: '4px' }}>
          Badges coming soon
        </div>
        <div style={{ fontSize: '12px', color: 'var(--n400)' }}>
          Earn achievements as you play
        </div>
      </div>
    </div>
  )
}
