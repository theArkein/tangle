'use client'

import { Suspense, useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import WordPill from '@/components/ui/WordPill'
import TimerBar from '@/components/ui/TimerBar'
import { POWER_UP_LABELS, type PowerUpId } from '@/lib/powerups'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// ── Backend types (mirrored from src/modules/MatchStateMachine.ts) ───────────

type PowerUpInventory = Record<PowerUpId, number>
type GameMode = 'classic' | 'speed_round'

type ActiveEffect =
  | { kind: 'freeze'; onPlayerId: string; expiresAt: number }
  | { kind: 'secondLifeArmed'; forPlayerId: string }
  | { kind: 'letterBomb'; onPlayerId: string; requiredLetter: string }
  | { kind: 'swapPending'; byPlayerId: string }
  | { kind: 'blind'; onPlayerId: string; turnsRemaining: number }
  | { kind: 'shrink'; onPlayerId: string; maxLength: number }
  | { kind: 'rush'; onPlayerId: string }
  | { kind: 'peek'; forPlayerId: string; turnsRemaining: number }
  | { kind: 'blitzClaimed'; byPlayerId: string }
  | { kind: 'wildfire'; turnsRemaining: number; multiplier: number }

interface DropTriggers {
  thresholdsCrossed: Record<string, number>
  rareLetterDropped: Record<string, boolean>
  longWordDropped: Record<string, boolean>
}

interface RoundState {
  roundNumber: number
  seedLetter: string
  chain: string[]
  currentPlayerId: string
  faults: Record<string, number>
  roundWinnerId?: string
  playerRoundScores: Record<string, number>
  powerUpInventory: Record<string, PowerUpInventory>
  activeEffects: ActiveEffect[]
  dropTriggers: DropTriggers
}

interface RoundEndContext {
  roundNumber: number
  winnerId: string
  nextRoundConfirmations: string[]
}

interface MatchState {
  status: 'waiting' | 'round_active' | 'round_complete' | 'match_complete'
  player1Id: string
  player2Id: string
  roundWins: Record<string, number>
  gameMode: GameMode
  currentRound?: RoundState
  roundEndContext?: RoundEndContext
  matchWinnerId?: string
}

interface WordEntry {
  word: string
  playerId: string
  points: number
  breakdown: { base: number; rareLetter: number; longWord: number }
}

interface RoundHistoryEntry {
  roundNumber: number
  winnerId: string
  words: WordEntry[]
}

type ServerMsg =
  | { type: 'state_update'; state: MatchState; scores: Record<string, number>; roundHistory: RoundHistoryEntry[] }
  | { type: 'waiting'; playerCount: number; mode?: GameMode }
  | { type: 'word_result'; valid: true; points: number; breakdown: { base: number; rareLetter: number; longWord: number }; multiplier?: number }
  | { type: 'word_result'; valid: false; reason: string }
  | { type: 'opponent_disconnected' }
  | { type: 'rematch_pending' }
  | { type: 'rematch_timeout' }
  | { type: 'power_up_earned'; playerId: string; powerup: PowerUpId; source: string }
  | { type: 'danger_zone_entered' }
  | { type: 'power_up_activated'; powerup: PowerUpId; byPlayerId: string; targetPlayerId: string | null; word?: string; points?: number }
  | { type: 'second_life_consumed'; playerId: string }
  | { type: 'reaction'; fromPlayerId: string; reaction: string }
  | { type: 'swap_letter_chosen'; byPlayerId: string; letter: string }
  | { type: 'typing_update'; fromPlayerId: string; partial: string }
  | { type: 'forfeit'; absentPlayerId: string }
  | { type: 'error'; message: string }

// ── Constants ────────────────────────────────────────────────────────────────

const NEXT_ROUND_SECONDS = 30

const MODE_CONFIG: Record<GameMode, { displayName: string; turnSeconds: number; maxFaults: number }> = {
  classic: { displayName: 'Classic Duel', turnSeconds: 60, maxFaults: 8 },
  speed_round: { displayName: 'Speed Round', turnSeconds: 8, maxFaults: 1 },
}

const REACTION_OPTIONS: Array<{ key: string; emoji: string }> = [
  { key: 'fire', emoji: '🔥' },
  { key: 'shocked', emoji: '😱' },
  { key: 'clap', emoji: '👏' },
  { key: 'skull', emoji: '💀' },
]
// ── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page: { display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--n50)', color: 'var(--n800)' } as React.CSSProperties,
  centeredFull: { display: 'flex', flexDirection: 'column', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '20px', textAlign: 'center' } as React.CSSProperties,
  header: { background: 'var(--n0)', borderBottom: '1px solid var(--n200)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' } as React.CSSProperties,
  scoreText: { fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--n800)' } as React.CSSProperties,
  sectionLabel: { fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--n400)' } as React.CSSProperties,
  bottomPanel: { background: 'var(--n0)', borderTop: '1px solid var(--n200)', padding: '12px 16px 20px' } as React.CSSProperties,
  input: { flex: 1, border: '1px solid var(--n200)', borderRadius: 'var(--radius-md)', padding: '12px 14px', fontSize: '15px', fontFamily: 'var(--font-body)', color: 'var(--n900)', outline: 'none', minWidth: 0, background: 'var(--n0)' } as React.CSSProperties,
} as const

// ── Game screen ──────────────────────────────────────────────────────────────

function GameContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const roomId = searchParams.get('room') ?? ''

  const [myId, setMyId] = useState<string | null>(null)
  const [googleLinked, setGoogleLinked] = useState(false)
  const [matchState, setMatchState] = useState<MatchState | null>(null)
  const [waitingCount, setWaitingCount] = useState<number | null>(null)
  const [disconnected, setDisconnected] = useState(false)
  const [wordInput, setWordInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null)
  const [timeLeft, setTimeLeft] = useState(60)
  const [nextRoundTimeLeft, setNextRoundTimeLeft] = useState(NEXT_ROUND_SECONDS)
  const [roundHistory, setRoundHistory] = useState<RoundHistoryEntry[]>([])
  const [rematchState, setRematchState] = useState<'idle' | 'pending'>('idle')
  const [showLinkPrompt, setShowLinkPrompt] = useState(false)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [powerUpToast, setPowerUpToast] = useState<{ id: PowerUpId; source: string } | null>(null)
  const [activatedFeed, setActivatedFeed] = useState<{ id: PowerUpId; byMe: boolean } | null>(null)
  const [myHighlights, setMyHighlights] = useState<Partial<Record<PowerUpId, 'earned' | 'activated'>>>({})
  const [oppHighlights, setOppHighlights] = useState<Partial<Record<PowerUpId, 'earned' | 'activated'>>>({})
  const [reactionFeed, setReactionFeed] = useState<Array<{ id: number; emoji: string; byMe: boolean }>>([])
  const [forfeitedBy, setForfeitedBy] = useState<string | null>(null)
  const [opponentTyping, setOpponentTyping] = useState<string>('')

  const wsRef = useRef<WebSocket | null>(null)
  const deferredInstallRef = useRef<BeforeInstallPromptEvent | null>(null)
  const prevStateRef = useRef<MatchState | null>(null)
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const turnStartAtRef = useRef(0)
  const nextRoundStartedAtRef = useRef(0)
  const reactionIdRef = useRef(0)

  // Load current player ID
  useEffect(() => {
    if (!roomId) return
    fetch('/api/me')
      .then(r => r.json())
      .then((d: { id: string; google_linked: boolean }) => { setMyId(d.id); setGoogleLinked(d.google_linked) })
      .catch(() => {})
  }, [roomId])

  // Open WebSocket once we know the player ID
  useEffect(() => {
    if (!myId || !roomId) return

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${proto}//${window.location.host}/api/rooms/${roomId}/ws`)
    wsRef.current = ws

    ws.onmessage = (ev) => {
      let msg: ServerMsg
      try {
        msg = JSON.parse(ev.data as string) as ServerMsg
      } catch {
        return
      }

      if (msg.type === 'waiting') {
        setWaitingCount(msg.playerCount)
        return
      }

      if (msg.type === 'opponent_disconnected') {
        setDisconnected(true)
        ws.close()
        return
      }

      if (msg.type === 'rematch_pending') {
        setRematchState('pending')
        return
      }

      if (msg.type === 'rematch_timeout') {
        router.push('/')
        return
      }

      if (msg.type === 'word_result') {
        setSubmitting(false)
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
        if (msg.valid) {
          setWordInput('')
          setFeedback({ text: `+${msg.points} pts`, ok: true })
        } else {
          setFeedback({ text: msg.reason ?? 'Invalid word', ok: false })
        }
        feedbackTimerRef.current = setTimeout(() => setFeedback(null), 2000)
        return
      }

      if (msg.type === 'power_up_earned') {
        const setter = msg.playerId === myId ? setMyHighlights : setOppHighlights
        setter(h => ({ ...h, [msg.powerup]: 'earned' }))
        setTimeout(() => setter(h => { const n = { ...h }; delete n[msg.powerup]; return n }), 1500)
        if (msg.playerId === myId) {
          setPowerUpToast({ id: msg.powerup, source: msg.source })
          setTimeout(() => setPowerUpToast(null), 2500)
        }
        return
      }

      if (msg.type === 'power_up_activated') {
        const setter = msg.byPlayerId === myId ? setMyHighlights : setOppHighlights
        setter(h => ({ ...h, [msg.powerup]: 'activated' }))
        setTimeout(() => setter(h => { const n = { ...h }; delete n[msg.powerup]; return n }), 1000)
        setActivatedFeed({ id: msg.powerup, byMe: msg.byPlayerId === myId })
        setTimeout(() => setActivatedFeed(null), 2500)
        return
      }

      if (msg.type === 'second_life_consumed') {
        const setter = msg.playerId === myId ? setMyHighlights : setOppHighlights
        setter(h => ({ ...h, secondLife: 'activated' }))
        setTimeout(() => setter(h => { const n = { ...h }; delete n.secondLife; return n }), 1000)
        setActivatedFeed({ id: 'secondLife', byMe: msg.playerId === myId })
        setTimeout(() => setActivatedFeed(null), 2500)
        return
      }

      if (msg.type === 'reaction') {
        const found = REACTION_OPTIONS.find(r => r.key === msg.reaction)
        const emoji = found?.emoji ?? '👍'
        const id = ++reactionIdRef.current
        setReactionFeed(prev => [...prev, { id, emoji, byMe: msg.fromPlayerId === myId }])
        setTimeout(() => {
          setReactionFeed(prev => prev.filter(r => r.id !== id))
        }, 3000)
        return
      }

      if (msg.type === 'danger_zone_entered') {
        setFeedback({ ok: true, text: 'DANGER ZONE — 3× scoring, 5s timer!' })
        setTimeout(() => setFeedback(null), 3000)
        return
      }

      if (msg.type === 'forfeit') {
        setForfeitedBy(msg.absentPlayerId)
        return
      }

      if (msg.type === 'typing_update') {
        setOpponentTyping(msg.partial)
        return
      }

      if (msg.type === 'swap_letter_chosen') {
        setActivatedFeed({ id: 'swap', byMe: msg.byPlayerId === myId })
        setTimeout(() => setActivatedFeed(null), 2500)
        return
      }

      if (msg.type === 'state_update') {
        const { state } = msg
        const prev = prevStateRef.current
        const prevRound = prev?.currentRound
        const newRound = state.currentRound

        if (state.status === 'match_complete') {
          setRematchState('idle')
        }

        if (state.status === 'round_complete' && prev?.status !== 'round_complete') {
          nextRoundStartedAtRef.current = Date.now()
          setNextRoundTimeLeft(NEXT_ROUND_SECONDS)
        }

        if (newRound) {
          const chainGrew = newRound.chain.length > (prevRound?.chain.length ?? -1)
          const roundChanged = newRound.roundNumber !== prevRound?.roundNumber
          const firstUpdate = !prevRound
          if (chainGrew || roundChanged || firstUpdate) {
            turnStartAtRef.current = Date.now()
          }
        }

        prevStateRef.current = state
        setRoundHistory(msg.roundHistory ?? [])
        setWaitingCount(null)
        setMatchState(state)
        setSubmitting(false)
        return
      }
    }

    ws.onerror = () => setDisconnected(true)

    return () => ws.close()
  }, [myId, roomId, router])

  // Visual countdown ticker — updates every 250 ms
  useEffect(() => {
    if (matchState?.status !== 'round_active') return
    const mode = matchState.gameMode ?? 'classic'
    const turnSecs = MODE_CONFIG[mode].turnSeconds
    const id = setInterval(() => {
      setTimeLeft(Math.max(0, turnSecs - (Date.now() - turnStartAtRef.current) / 1000))
    }, 250)
    return () => clearInterval(id)
  }, [matchState?.status, matchState?.gameMode])

  // Next-round countdown ticker
  useEffect(() => {
    if (matchState?.status !== 'round_complete') return
    const id = setInterval(() => {
      setNextRoundTimeLeft(Math.max(0, NEXT_ROUND_SECONDS - (Date.now() - nextRoundStartedAtRef.current) / 1000))
    }, 250)
    return () => clearInterval(id)
  }, [matchState?.status])

  const submitWord = useCallback(() => {
    const word = wordInput.trim().toLowerCase()
    if (!word || submitting || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'submit_word', word }))
    setSubmitting(true)
    setFeedback(null)
  }, [wordInput, submitting])

  const sendNextRoundRequest = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'next_round_request' }))
  }, [])

  const activatePowerUp = useCallback((id: PowerUpId) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'use_powerup', powerup: id }))
  }, [])

  const sendReaction = useCallback((reaction: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'send_reaction', reaction }))
  }, [])

  // Show Google link prompt once after first match win
  useEffect(() => {
    if (
      matchState?.status === 'match_complete' &&
      matchState.matchWinnerId === myId &&
      !googleLinked &&
      !localStorage.getItem('link_prompt_dismissed')
    ) {
      const t = setTimeout(() => setShowLinkPrompt(true), 0)
      return () => clearTimeout(t)
    }
  }, [matchState?.status, matchState?.matchWinnerId, myId, googleLinked])

  // Capture install prompt — show after first match win
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      deferredInstallRef.current = e as BeforeInstallPromptEvent
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  useEffect(() => {
    if (
      matchState?.status === 'match_complete' &&
      matchState.matchWinnerId === myId &&
      deferredInstallRef.current &&
      !localStorage.getItem('install_prompt_dismissed')
    ) {
      const t = setTimeout(() => setShowInstallPrompt(true), 0)
      return () => clearTimeout(t)
    }
  }, [matchState?.status, matchState?.matchWinnerId, myId])

  const sendRematchRequest = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'rematch_request' }))
    setRematchState('pending')
  }, [])

  // ── Disconnected ─────────────────────────────────────────────────────────

  if (disconnected) {
    return (
      <div style={S.centeredFull}>
        <div style={{ fontSize: '32px' }}>📡</div>
        <p style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-heading)', color: 'var(--n900)' }}>
          Opponent disconnected
        </p>
        <p style={{ fontSize: '13px', color: 'var(--n400)' }}>The game has ended</p>
        <Button variant="secondary" onClick={() => router.push('/')}>Back to lobby</Button>
      </div>
    )
  }

  // ── Waiting for opponent ─────────────────────────────────────────────────

  if (!matchState && waitingCount !== null) {
    return (
      <div style={S.centeredFull}>
        <div style={{ position: 'relative', width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--n400)', opacity: 0.2, animation: 'ping 1.2s cubic-bezier(0,0,0.2,1) infinite' }} />
          <span style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--n400)', opacity: 0.8, display: 'block' }} />
        </div>
        <p style={{ fontSize: '17px', fontWeight: 600, fontFamily: 'var(--font-heading)', color: 'var(--n900)' }}>
          Waiting for opponent…
        </p>
        <p style={{ fontSize: '13px', color: 'var(--n400)', fontFamily: 'var(--font-mono)' }}>
          {waitingCount}/2 players connected
        </p>
        <style>{`@keyframes ping { 75%,100% { transform: scale(2); opacity: 0; } }`}</style>
      </div>
    )
  }

  // ── Loading ──────────────────────────────────────────────────────────────

  if (!matchState || !myId) {
    return (
      <div style={{ ...S.centeredFull }}>
        <div style={{ width: 28, height: 28, border: '3px solid var(--n200)', borderTopColor: 'var(--n900)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── Forfeit notice (lives only briefly before match_complete arrives) ────

  if (forfeitedBy && matchState.status !== 'match_complete') {
    const youForfeited = forfeitedBy === myId
    return (
      <div style={S.centeredFull}>
        <div style={{ fontSize: '32px' }}>{youForfeited ? '⏱' : '🏆'}</div>
        <p style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-heading)', color: 'var(--n900)' }}>
          {youForfeited ? 'You forfeited the match' : 'Opponent forfeited — you win!'}
        </p>
        <p style={{ fontSize: '13px', color: 'var(--n400)' }}>
          {youForfeited ? "You didn't confirm Play Again in time" : 'They did not confirm Play Again in time'}
        </p>
      </div>
    )
  }

  // ── Match complete — result screen ───────────────────────────────────────

  if (matchState.status === 'match_complete') {
    const won = matchState.matchWinnerId === myId
    const opponentId = matchState.player1Id === myId ? matchState.player2Id : matchState.player1Id

    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--n0)' }}>
        {/* Result header */}
        <div style={{ flexShrink: 0, padding: '36px 20px 24px', textAlign: 'center', borderBottom: '1px solid var(--n100)' }}>
          <div style={{ fontSize: '44px', marginBottom: '10px' }}>{won ? '🏆' : '😔'}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--n900)', marginBottom: '6px' }}>
            {won ? 'Victory!' : 'Defeat'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '14px' }}>
            <div style={{ textAlign: 'center' }}>
              <Avatar name="You" variant="p1" size={38} />
              <div style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--n900)', marginTop: '6px' }}>
                {matchState.roundWins[myId] ?? 0}
              </div>
            </div>
            <span style={{ fontSize: '13px', color: 'var(--n300)', fontWeight: 500 }}>VS</span>
            <div style={{ textAlign: 'center' }}>
              <Avatar name="?" variant="p2" size={38} />
              <div style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--n400)', marginTop: '6px' }}>
                {matchState.roundWins[opponentId] ?? 0}
              </div>
            </div>
          </div>
        </div>

        {/* Round replay */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
          <div style={{ ...S.sectionLabel, marginBottom: '12px' }}>Round recap</div>
          {roundHistory.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--n400)', textAlign: 'center', padding: '20px 0' }}>
              No round data available
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {roundHistory.map(rh => (
                <div key={rh.roundNumber} style={{ border: '1px solid var(--n200)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--n0)' }}>
                  <div style={{ padding: '10px 14px', background: 'var(--n50)', borderBottom: '1px solid var(--n100)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ ...S.sectionLabel }}>Round {rh.roundNumber}</span>
                    <Badge variant={rh.winnerId === myId ? 'success' : 'danger'} size="xs">
                      {rh.winnerId === myId ? 'You won' : 'Opponent won'}
                    </Badge>
                  </div>
                  {rh.words.length === 0 ? (
                    <p style={{ fontSize: '13px', color: 'var(--n400)', fontStyle: 'italic', padding: '12px 14px' }}>No words played</p>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '12px 14px' }}>
                      {rh.words.map((entry, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <WordPill
                            word={entry.word}
                            variant={entry.playerId === myId ? 'player1' : 'player2'}
                            size="sm"
                          />
                          {entry.breakdown.rareLetter > 0 && (
                            <Badge variant="rare" size="xs">rare</Badge>
                          )}
                          {entry.breakdown.longWord > 0 && (
                            <Badge variant="info" size="xs">long</Badge>
                          )}
                          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--n400)' }}>
                            +{entry.points}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Google link prompt */}
        {showLinkPrompt && (
          <div style={{ margin: '0 16px 8px', border: '1px solid var(--accent-warm-light)', borderRadius: 'var(--radius-lg)', background: 'var(--accent-warm-faint)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--n800)', marginBottom: '2px' }}>Save your progress</div>
              <div style={{ fontSize: '12px', color: 'var(--n500)' }}>Link Google to recover your account on any device</div>
            </div>
            <a href="/api/auth/google" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-warm-muted)', whiteSpace: 'nowrap', textDecoration: 'none' }}>Link →</a>
            <button
              onClick={() => { localStorage.setItem('link_prompt_dismissed', '1'); setShowLinkPrompt(false) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--n400)', fontSize: '16px', padding: '0 2px' }}
              aria-label="Dismiss"
            >×</button>
          </div>
        )}

        {/* Actions */}
        <div style={{ flexShrink: 0, borderTop: '1px solid var(--n100)', padding: '16px 16px 32px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {rematchState === 'idle' ? (
            <Button variant="primary" size="lg" full onClick={sendRematchRequest}>Rematch</Button>
          ) : (
            <div style={{ height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '1px solid var(--n200)', borderRadius: 'var(--radius-md)', background: 'var(--n0)' }}>
              <div style={{ width: '14px', height: '14px', border: '2px solid var(--n300)', borderTopColor: 'var(--n700)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: '13px', color: 'var(--n500)' }}>Waiting for opponent…</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}
          <Button variant="secondary" size="lg" full onClick={() => router.push('/')}>Back to lobby</Button>
          {showInstallPrompt && (
            <Button
              variant="ghost"
              size="md"
              full
              onClick={async () => {
                const prompt = deferredInstallRef.current
                if (!prompt) return
                await prompt.prompt()
                const { outcome } = await prompt.userChoice
                deferredInstallRef.current = null
                setShowInstallPrompt(false)
                if (outcome === 'dismissed') {
                  localStorage.setItem('install_prompt_dismissed', '1')
                }
              }}
            >
              Add to Home Screen
            </Button>
          )}
        </div>
      </div>
    )
  }

  // ── Round complete — Play Again gate ─────────────────────────────────────

  if (matchState.status === 'round_complete') {
    const ctx = matchState.roundEndContext
    const opponentId = matchState.player1Id === myId ? matchState.player2Id : matchState.player1Id
    const myWins = matchState.roundWins[myId] ?? 0
    const oppWins = matchState.roundWins[opponentId] ?? 0
    const iWonRound = ctx?.winnerId === myId
    const iConfirmed = ctx?.nextRoundConfirmations.includes(myId) ?? false
    const opponentConfirmed = ctx?.nextRoundConfirmations.includes(opponentId) ?? false

    return (
      <div style={{ ...S.page, justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
        <div style={{ width: '100%', maxWidth: 420, background: 'var(--n0)', border: '1px solid var(--n200)', borderRadius: 'var(--radius-xl)', padding: '28px 24px', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>{iWonRound ? '🎉' : '😤'}</div>
          <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--n400)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
            Round {ctx?.roundNumber ?? '?'} complete
          </p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--n900)', marginBottom: '4px' }}>
            {iWonRound ? 'You won the round!' : 'Opponent won the round'}
          </p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--n500)', marginBottom: '20px' }}>
            {myWins} – {oppWins}
          </p>

          <Button variant="primary" size="lg" full onClick={sendNextRoundRequest} disabled={iConfirmed}>
            {iConfirmed ? 'Ready ✓' : 'Play Again'}
          </Button>

          <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--n500)' }}>
            {opponentConfirmed ? 'Opponent is ready' : 'Waiting on opponent…'}
            <span style={{ marginLeft: '8px', fontFamily: 'var(--font-mono)', color: nextRoundTimeLeft <= 5 ? 'var(--danger)' : 'var(--n400)' }}>
              {Math.ceil(nextRoundTimeLeft)}s
            </span>
          </div>
        </div>
      </div>
    )
  }

  // ── Round active ─────────────────────────────────────────────────────────

  const round = matchState.currentRound
  if (!round) {
    return (
      <div style={S.centeredFull}>
        <div style={{ width: 28, height: 28, border: '3px solid var(--n200)', borderTopColor: 'var(--n900)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const isMyTurn = round.currentPlayerId === myId
  const opponentId = matchState.player1Id === myId ? matchState.player2Id : matchState.player1Id
  const myWins = matchState.roundWins[myId] ?? 0
  const oppWins = matchState.roundWins[opponentId] ?? 0
  const myFaults = round.faults[myId] ?? 0
  const oppFaults = round.faults[opponentId] ?? 0
  const gameMode: GameMode = matchState.gameMode ?? 'classic'
  const modeCfg = MODE_CONFIG[gameMode]
  const emptyInv: PowerUpInventory = { freeze: 0, secondLife: 0, letterBomb: 0, block: 0, swap: 0, blind: 0, shrink: 0, rush: 0, steal: 0, peek: 0, blitz: 0, wildfire: 0 }
  const myInventory: PowerUpInventory = round.powerUpInventory[myId] ?? emptyInv
  const opponentInventory: PowerUpInventory = round.powerUpInventory[opponentId] ?? emptyInv
  const myLetterBomb = round.activeEffects.find(e => e.kind === 'letterBomb' && e.onPlayerId === myId)
  const opponentLetterBomb = round.activeEffects.find(e => e.kind === 'letterBomb' && e.onPlayerId === opponentId)
  const myShrink = round.activeEffects.find(e => e.kind === 'shrink' && e.onPlayerId === myId)
  const myRush = round.activeEffects.find(e => e.kind === 'rush' && e.onPlayerId === myId)
  const blindOnMe = round.activeEffects.find(e => e.kind === 'blind' && e.onPlayerId === myId)
  const wildfire = round.activeEffects.find(e => e.kind === 'wildfire')
  const swapPending = round.activeEffects.find(e => e.kind === 'swapPending' && e.byPlayerId === myId)
  const myBlitzClaimed = round.activeEffects.find(e => e.kind === 'blitzClaimed' && e.byPlayerId === myId)
  const peekActive = round.activeEffects.find(e => e.kind === 'peek' && e.forPlayerId === myId)
  const inDangerZone = round.chain.length >= 20
  const timerPct = (timeLeft / modeCfg.turnSeconds) * 100
  const timerUrgent = timeLeft <= 5 || inDangerZone
  const lastWord = round.chain[round.chain.length - 1]
  const nextSeed = lastWord ? lastWord.slice(-1).toUpperCase() : round.seedLetter.toUpperCase()

  return (
    <div style={S.page}>
      {/* Power-up earned toast */}
      {powerUpToast && (
        <div style={{ position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 60, background: 'var(--n900)', color: 'var(--n0)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
          <span style={{ fontSize: '18px' }}>{POWER_UP_LABELS[powerUpToast.id].emoji}</span>
          <span>Earned {POWER_UP_LABELS[powerUpToast.id].name}</span>
        </div>
      )}

      {/* Power-up activated banner */}
      {activatedFeed && (
        <div style={{ position: 'fixed', top: 56, left: '50%', transform: 'translateX(-50%)', zIndex: 55, background: 'var(--accent-warm-muted)', color: 'var(--n0)', padding: '8px 12px', borderRadius: 'var(--radius-md)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>{POWER_UP_LABELS[activatedFeed.id].emoji}</span>
          <span>{activatedFeed.byMe ? 'You used' : 'Opponent used'} {POWER_UP_LABELS[activatedFeed.id].name}</span>
        </div>
      )}

      {/* Live reactions */}
      {reactionFeed.length > 0 && (
        <div style={{ position: 'fixed', bottom: 220, left: 0, right: 0, zIndex: 50, display: 'flex', justifyContent: 'center', gap: '8px', pointerEvents: 'none' }}>
          {reactionFeed.map(r => (
            <div key={r.id} style={{ fontSize: '28px', animation: 'reactionFloat 3s ease-out forwards' }}>
              {r.emoji}
            </div>
          ))}
          <style>{`@keyframes reactionFloat { 0% { opacity: 0; transform: translateY(20px); } 20% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-40px); } }`}</style>
        </div>
      )}

      {/* Game header */}
      <div style={{ background: 'var(--n0)', borderBottom: '1px solid var(--n200)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <button
          onClick={() => router.push('/')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--n400)', padding: '4px', lineHeight: 1 }}
          aria-label="Back to lobby"
        >←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-heading)', color: 'var(--n900)' }}>{modeCfg.displayName}</div>
          <div style={{ fontSize: '11px', color: 'var(--n400)', fontFamily: 'var(--font-mono)' }}>Round {round.roundNumber}</div>
        </div>
        <span style={S.scoreText}>{myWins} – {oppWins}</span>
      </div>

      {/* Player row */}
      <div style={{ background: 'var(--n0)', borderBottom: '1px solid var(--n100)', padding: '10px 14px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <Avatar name="You" variant="p1" size={28} />
          <div>
            <div style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'var(--font-heading)', color: 'var(--n800)' }}>You</div>
            <div style={{ display: 'flex', gap: '2px', marginTop: '3px' }}>
              {Array.from({ length: modeCfg.maxFaults }).map((_, i) => (
                <span key={i} style={{ display: 'block', width: '5px', height: '5px', borderRadius: '50%', background: i < myFaults ? 'var(--danger)' : 'var(--n200)' }} />
              ))}
            </div>
          </div>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--n300)', fontWeight: 500 }}>VS</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'flex-end' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', fontWeight: 500, fontFamily: 'var(--font-heading)', color: 'var(--n800)' }}>Opponent</div>
            <div style={{ display: 'flex', gap: '2px', marginTop: '3px', justifyContent: 'flex-end' }}>
              {Array.from({ length: modeCfg.maxFaults }).map((_, i) => (
                <span key={i} style={{ display: 'block', width: '5px', height: '5px', borderRadius: '50%', background: i < oppFaults ? 'var(--danger)' : 'var(--n200)' }} />
              ))}
            </div>
          </div>
          <Avatar name="?" variant="p2" size={28} />
        </div>
      </div>

      {/* Letter Bomb active banner */}
      {/* Danger Zone banner */}
      {inDangerZone && (
        <div style={{ background: 'var(--danger-zone-bg)', borderBottom: '1px solid var(--danger-zone)', padding: '8px 14px', fontSize: '12px', color: 'var(--danger-zone)', textAlign: 'center', flexShrink: 0, fontWeight: 700, letterSpacing: '0.04em' }}>
          DANGER ZONE — 3× scoring · 5s timer
        </div>
      )}

      {myLetterBomb && myLetterBomb.kind === 'letterBomb' && (
        <div style={{ background: 'var(--accent-warm-faint)', borderBottom: '1px solid var(--accent-warm-light)', padding: '8px 14px', fontSize: '12px', color: 'var(--accent-warm-muted)', textAlign: 'center', flexShrink: 0 }}>
          💣 Letter Bomb active — your next word must contain <strong>{myLetterBomb.requiredLetter}</strong>
        </div>
      )}
      {opponentLetterBomb && opponentLetterBomb.kind === 'letterBomb' && (
        <div style={{ background: 'var(--n50)', borderBottom: '1px solid var(--n100)', padding: '6px 14px', fontSize: '11px', color: 'var(--n500)', textAlign: 'center', flexShrink: 0 }}>
          Opponent must use <strong>{opponentLetterBomb.requiredLetter}</strong>
        </div>
      )}

      {/* Shrink banner */}
      {myShrink && myShrink.kind === 'shrink' && (
        <div style={{ background: 'var(--accent-warm-faint)', borderBottom: '1px solid var(--accent-warm-light)', padding: '8px 14px', fontSize: '12px', color: 'var(--accent-warm-muted)', textAlign: 'center', flexShrink: 0 }}>
          🤏 Shrink — your next word must be ≤ <strong>{myShrink.maxLength}</strong> letters
        </div>
      )}

      {/* Rush banner */}
      {myRush && myRush.kind === 'rush' && (
        <div style={{ background: 'var(--accent-warm-faint)', borderBottom: '1px solid var(--accent-warm-light)', padding: '8px 14px', fontSize: '12px', color: 'var(--accent-warm-muted)', textAlign: 'center', flexShrink: 0 }}>
          ⚡ Rush — your next turn is half-length
        </div>
      )}

      {/* Wildfire banner */}
      {wildfire && wildfire.kind === 'wildfire' && (
        <div style={{ background: '#ffeb99', borderBottom: '1px solid #f5d76e', padding: '8px 14px', fontSize: '12px', color: '#7d5a00', textAlign: 'center', flexShrink: 0, fontWeight: 600 }}>
          🔥 Wildfire — {wildfire.multiplier}× scoring · {wildfire.turnsRemaining} turn{wildfire.turnsRemaining === 1 ? '' : 's'} left
        </div>
      )}

      {/* Blitz claimed indicator */}
      {myBlitzClaimed && (
        <div style={{ background: 'var(--accent-warm-faint)', borderBottom: '1px solid var(--accent-warm-light)', padding: '6px 14px', fontSize: '11px', color: 'var(--accent-warm-muted)', textAlign: 'center', flexShrink: 0 }}>
          ⚔️ Blitz claimed — you&apos;ll get another turn after this word
        </div>
      )}

      {/* Peek active */}
      {peekActive && (
        <div style={{ background: '#e8f5e9', borderBottom: '1px solid #c8e6c9', padding: '6px 14px', fontSize: '11px', color: '#2e7d32', textAlign: 'center', flexShrink: 0 }}>
          👁 Peek — opponent typing: <strong style={{ fontFamily: 'var(--font-mono)' }}>{opponentTyping || '…'}</strong>
        </div>
      )}

      {/* Swap letter picker */}
      {swapPending && (
        <div style={{ background: 'var(--n0)', borderBottom: '1px solid var(--n200)', padding: '10px 14px', flexShrink: 0 }}>
          <div style={{ fontSize: '12px', color: 'var(--n700)', marginBottom: 6, fontWeight: 600 }}>
            🔀 Swap — pick a new chain letter:
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {'abcdefghijklmnopqrstuvwxyz'.split('').map(letter => (
              <button
                key={letter}
                onClick={() => {
                  if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: 'swap_choose_letter', letter }))
                  }
                }}
                style={{
                  width: 26, height: 26, borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--n200)', background: 'var(--n0)',
                  fontFamily: 'var(--font-mono)', fontSize: 12,
                  cursor: 'pointer', textTransform: 'uppercase',
                }}
              >{letter}</button>
            ))}
          </div>
        </div>
      )}

      {/* Word chain */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignContent: 'center', justifyContent: 'center' }}>
        {blindOnMe && blindOnMe.kind === 'blind' ? (
          <div style={{ textAlign: 'center', width: '100%', color: 'var(--n400)' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🙈</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Chain hidden by Blind</div>
            <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>{blindOnMe.turnsRemaining} turn{blindOnMe.turnsRemaining === 1 ? '' : 's'} remaining</div>
          </div>
        ) : round.chain.length === 0 ? (
          <div style={{ textAlign: 'center', width: '100%' }}>
            <div style={{ ...S.sectionLabel, marginBottom: '10px' }}>Start with</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '56px', color: 'var(--n900)', letterSpacing: '-1px' }}>
              {round.seedLetter.toUpperCase()}
            </div>
          </div>
        ) : (
          round.chain.map((word, i) => {
            const isOwn = matchState.player1Id === myId
              ? i % 2 === 0
              : i % 2 !== 0
            const isLong = word.length >= 8
            return (
              <span
                key={i}
                style={isLong ? { display: 'inline-flex', animation: 'wordShimmer 1.6s ease-out' } : undefined}
              >
                <WordPill
                  word={word}
                  variant={isOwn ? 'player1' : 'player2'}
                  size="sm"
                />
              </span>
            )
          })
        )}
        <style>{`
          @keyframes wordShimmer { 0% { filter: brightness(1.6) saturate(1.5); transform: scale(1.05); } 100% { filter: brightness(1) saturate(1); transform: scale(1); } }
          @keyframes earnGlow { 0% { box-shadow: 0 0 0 2px #4caf50; } 60% { box-shadow: 0 0 8px 4px #4caf5088; } 100% { box-shadow: 0 0 0 2px #4caf50; } }
          @keyframes activateFlash { 0% { background: var(--accent-warm-faint); } 50% { background: #ffe09a; } 100% { background: var(--n0); } }
        `}</style>
      </div>

      {/* Bottom panel */}
      <div style={S.bottomPanel}>
        {/* Power-up HUD */}
        {gameMode === 'classic' && (
          <div style={{ marginBottom: '10px' }}>
            <div style={{ ...S.sectionLabel, marginBottom: '4px' }}>Opponent</div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
              {(Object.keys(POWER_UP_LABELS) as PowerUpId[]).map((id) => {
                const count = opponentInventory[id] ?? 0
                const hl = oppHighlights[id]
                return (
                  <div
                    key={id}
                    title={POWER_UP_LABELS[id].name}
                    style={{
                      width: 40, height: 44,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                      border: hl === 'earned' ? '1px solid #4caf50' : hl === 'activated' ? '1px solid var(--accent-warm)' : '1px solid var(--n200)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--n0)',
                      opacity: count === 0 ? 0.3 : 1,
                      filter: count === 0 ? 'grayscale(1)' : 'none',
                      animation: hl === 'earned' ? 'earnGlow 0.8s ease-out' : hl === 'activated' ? 'activateFlash 0.6s ease-out' : 'none',
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{POWER_UP_LABELS[id].emoji}</span>
                    <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--n500)', visibility: count > 0 ? 'visible' : 'hidden' }}>×{count}</span>
                  </div>
                )
              })}
            </div>
            <div style={{ ...S.sectionLabel, marginBottom: '4px' }}>You</div>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {(Object.keys(POWER_UP_LABELS) as PowerUpId[]).map((id) => {
                const count = myInventory[id] ?? 0
                const hl = myHighlights[id]
                const turnLocked = !isMyTurn && id !== 'secondLife' && id !== 'block'
                return (
                  <button
                    key={id}
                    onClick={() => activatePowerUp(id)}
                    disabled={count === 0 || turnLocked}
                    title={POWER_UP_LABELS[id].name}
                    style={{
                      width: 40, height: 44, padding: 0,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                      border: hl === 'earned' ? '1px solid #4caf50' : hl === 'activated' ? '1px solid var(--accent-warm)' : '1px solid var(--n200)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--n0)',
                      cursor: count > 0 && !turnLocked ? 'pointer' : 'default',
                      opacity: count === 0 ? 0.3 : (turnLocked ? 0.45 : 1),
                      filter: count === 0 ? 'grayscale(1)' : 'none',
                      animation: hl === 'earned' ? 'earnGlow 0.8s ease-out' : hl === 'activated' ? 'activateFlash 0.6s ease-out' : 'none',
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{POWER_UP_LABELS[id].emoji}</span>
                    <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--n500)', visibility: count > 0 ? 'visible' : 'hidden' }}>×{count}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Reaction bar */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', justifyContent: 'center' }}>
          {REACTION_OPTIONS.map(r => (
            <button
              key={r.key}
              onClick={() => sendReaction(r.key)}
              style={{
                background: 'transparent',
                border: '1px solid var(--n200)',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                fontSize: '16px',
                cursor: 'pointer',
                lineHeight: 1,
              }}
              aria-label={`React ${r.key}`}
            >
              {r.emoji}
            </button>
          ))}
        </div>

        {/* Timer */}
        <div style={{ marginBottom: '10px' }}>
          <TimerBar
            percent={timerPct}
            danger={timerUrgent}
            label={`${Math.ceil(timeLeft)}s`}
          />
        </div>

        {/* Turn indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 500, color: isMyTurn ? 'var(--success)' : 'var(--n400)' }}>
            {isMyTurn ? 'Your turn' : "Opponent's turn"}
          </span>
          {round.chain.length > 0 && (
            <span style={{ fontSize: '12px', color: 'var(--n500)', fontFamily: 'var(--font-mono)' }}>
              starts with <strong style={{ color: 'var(--n800)' }}>{nextSeed}</strong>
            </span>
          )}
        </div>

        {/* Feedback */}
        {feedback && (
          <p style={{ fontSize: '13px', fontWeight: 500, color: feedback.ok ? 'var(--success)' : 'var(--danger)', marginBottom: '8px' }}>
            {feedback.text}
          </p>
        )}

        {/* Input row */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={wordInput}
            onChange={e => {
              const v = e.target.value
              setWordInput(v)
              if (wsRef.current?.readyState === WebSocket.OPEN && isMyTurn) {
                wsRef.current.send(JSON.stringify({ type: 'typing_update', partial: v }))
              }
            }}
            onKeyDown={e => { if (e.key === 'Enter') submitWord() }}
            disabled={!isMyTurn || submitting}
            placeholder={
              isMyTurn
                ? round.chain.length === 0
                  ? `Word starting with ${round.seedLetter.toUpperCase()}…`
                  : `Word starting with ${nextSeed}…`
                : 'Waiting for opponent…'
            }
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            style={{ ...S.input, opacity: !isMyTurn || submitting ? 0.45 : 1, cursor: !isMyTurn || submitting ? 'not-allowed' : 'text' }}
          />
          <Button
            variant="primary"
            size="md"
            onClick={submitWord}
            disabled={!isMyTurn || submitting || !wordInput.trim()}
          >
            {submitting ? '…' : '→'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function GamePage() {
  return (
    <Suspense>
      <GameContent />
    </Suspense>
  )
}
