'use client'

import { useEffect, useState } from 'react'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'

interface PlayerData {
  id: string
  display_name: string
  elo: number
}

interface MatchRecord {
  id: string
  opponent: string
  outcome: 'win' | 'loss'
  roundScores: [number, number]
  date: number
}

export default function ProfilePage() {
  const [player, setPlayer] = useState<PlayerData | null>(null)
  const [matches, setMatches] = useState<MatchRecord[]>([])
  const [loading, setLoading] = useState(true)

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
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--n900)', marginBottom: '8px' }}>
          {player.display_name}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
          <Badge variant="neutral">
            <span style={{ fontFamily: 'var(--font-mono)' }}>ELO {player.elo}</span>
          </Badge>
        </div>
      </Card>

      {/* Stat boxes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
        {[
          { label: 'ELO', value: String(player.elo) },
          { label: 'Matches', value: String(matches.length) },
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
