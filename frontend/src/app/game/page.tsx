'use client'

import { Suspense, useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import WordPill from '@/components/ui/WordPill'
import TimerBar from '@/components/ui/TimerBar'
import GameToast, { type ToastVariant, TOAST_DURATION } from '@/components/ui/GameToast'
import GameKeyboard from '@/components/ui/GameKeyboard'
import { useSoundEngine } from '@/hooks/useSoundEngine'
import { POWER_UP_LABELS, POWER_UP_GUIDE, type PowerUpId } from '@/lib/powerups'

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
const POWER_DESC = Object.fromEntries(
  POWER_UP_GUIDE.map(e => [e.id, { own: e.description, opp: e.opponentDescription }])
) as Record<PowerUpId, { own: string; opp: string }>

function PowerUpTooltip({ id, description, children }: { id: PowerUpId; description: string; children: React.ReactNode }) {
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null)
  const ref = useRef<HTMLSpanElement>(null)
  return (
    <span
      ref={ref}
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => {
        if (ref.current) {
          const r = ref.current.getBoundingClientRect()
          setAnchor({ x: r.left + r.width / 2, y: r.top })
        }
      }}
      onMouseLeave={() => setAnchor(null)}
    >
      {children}
      {anchor && (
        <span style={{
          position: 'fixed',
          top: anchor.y - 7,
          left: anchor.x,
          transform: 'translate(-50%, -100%)',
          background: 'var(--n900)',
          color: 'var(--n0)',
          padding: '6px 9px',
          borderRadius: 7,
          fontSize: 11,
          lineHeight: 1.4,
          width: 170,
          textAlign: 'center',
          pointerEvents: 'none',
          zIndex: 9999,
          boxShadow: '0 3px 10px rgba(0,0,0,0.30)',
        } as React.CSSProperties}>
          <strong style={{ display: 'block', fontSize: 13, marginBottom: 3 }}>{POWER_UP_LABELS[id].emoji} {POWER_UP_LABELS[id].name}</strong>
          {description}
          <span style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '4px solid var(--n900)' }} />
        </span>
      )}
    </span>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page: { display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', maxWidth: '100vw', overscrollBehavior: 'none', background: 'var(--n50)', color: 'var(--n800)' } as React.CSSProperties,
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
  const [floats, setFloats] = useState<Array<{ id: number; text: string; ok: boolean; byMe: boolean }>>([])
  const floatIdRef = useRef(0)
  const [timeLeft, setTimeLeft] = useState(60)
  const [nextRoundTimeLeft, setNextRoundTimeLeft] = useState(NEXT_ROUND_SECONDS)
  const [roundHistory, setRoundHistory] = useState<RoundHistoryEntry[]>([])
  const [gameScores, setGameScores] = useState<Record<string, number>>({})
  const [rematchState, setRematchState] = useState<'idle' | 'pending'>('idle')
  const [showLinkPrompt, setShowLinkPrompt] = useState(false)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [myHighlights, setMyHighlights] = useState<Partial<Record<PowerUpId, 'earned' | 'activated'>>>({})
  const [oppHighlights, setOppHighlights] = useState<Partial<Record<PowerUpId, 'earned' | 'activated'>>>({})
  const [reactionFeed, setReactionFeed] = useState<Array<{ id: number; emoji: string; byMe: boolean }>>([])
  const [forfeitedBy, setForfeitedBy] = useState<string | null>(null)
  const [opponentTyping, setOpponentTyping] = useState<string>('')

  const [isMobile, setIsMobile] = useState(false)
  const [keyboardVisible, setKeyboardVisible] = useState(true)
  const [activeToast, setActiveToast] = useState<{ id: number; variant: ToastVariant; subText?: string } | null>(null)
  const toastIdRef = useRef(0)
  const [powerNotifs, setPowerNotifs] = useState<Array<{ id: number; emoji: string; title: string; desc: string; byMe: boolean }>>([])
  const notifIdRef = useRef(0)
  const [reactionsOpen, setReactionsOpen] = useState(false)

  const { play, muted, setMuted } = useSoundEngine()
  const playRef = useRef(play)
  useEffect(() => { playRef.current = play }, [play])
  useEffect(() => { setIsMobile(navigator.maxTouchPoints > 0) }, [])

  useEffect(() => {
    if (!activeToast) return
    const id = setTimeout(() => setActiveToast(null), TOAST_DURATION)
    return () => clearTimeout(id)
  }, [activeToast?.id])

  const wsRef = useRef<WebSocket | null>(null)
  const chainScrollRef = useRef<HTMLDivElement>(null)
  const deferredInstallRef = useRef<BeforeInstallPromptEvent | null>(null)
  const prevStateRef = useRef<MatchState | null>(null)

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
    const wsHost = process.env.NODE_ENV === 'development' ? `${window.location.hostname}:8787` : window.location.host
    const wsUrl = `${proto}//${wsHost}/api/rooms/${roomId}/ws`
    console.log('[ws] connecting to', wsUrl)
    const ws = new WebSocket(wsUrl)
    ws.onopen = () => console.log('[ws] opened')
    ws.onerror = (e) => console.log('[ws] error', e.type)
    ws.onclose = (e) => console.log('[ws] closed code=' + e.code)
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
        if (msg.valid) {
          setWordInput('')
          const id = ++floatIdRef.current
          setFloats(prev => [...prev, { id, text: `+${msg.points}`, ok: true, byMe: true }])
          setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 2000)
          playRef.current('word_valid')
        } else {
          const id = ++floatIdRef.current
          setFloats(prev => [...prev, { id, text: msg.reason ?? 'Invalid', ok: false, byMe: true }])
          setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 2000)
          setActiveToast({ id: ++toastIdRef.current, variant: 'error', subText: msg.reason })
          playRef.current('word_invalid')
        }
        return
      }

      if (msg.type === 'power_up_earned') {
        const isMe = msg.playerId === myId
        const setter = isMe ? setMyHighlights : setOppHighlights
        setter(h => ({ ...h, [msg.powerup]: 'earned' }))
        setTimeout(() => setter(h => { const n = { ...h }; delete n[msg.powerup]; return n }), 1500)
        const pLabel = POWER_UP_LABELS[msg.powerup]
        const pDesc = POWER_DESC[msg.powerup]
        const nid = ++notifIdRef.current
        setPowerNotifs(prev => [...prev, { id: nid, emoji: pLabel?.emoji ?? '', title: `${isMe ? 'You' : 'Opponent'} picked up ${pLabel?.name}`, desc: isMe ? (pDesc?.own ?? '') : (pDesc?.opp ?? ''), byMe: isMe }])
        setTimeout(() => setPowerNotifs(prev => prev.filter(n => n.id !== nid)), 2500)
        playRef.current(isMe ? 'power_earned' : 'opp_turn')
        return
      }

      if (msg.type === 'power_up_activated') {
        const isMe = msg.byPlayerId === myId
        const setter = isMe ? setMyHighlights : setOppHighlights
        setter(h => ({ ...h, [msg.powerup]: 'activated' }))
        setTimeout(() => setter(h => { const n = { ...h }; delete n[msg.powerup]; return n }), 1000)
        const pLabel2 = POWER_UP_LABELS[msg.powerup]
        const pDesc2 = POWER_DESC[msg.powerup]
        const nid2 = ++notifIdRef.current
        setPowerNotifs(prev => [...prev, { id: nid2, emoji: pLabel2?.emoji ?? '', title: `${isMe ? 'You' : 'Opponent'} activated ${pLabel2?.name}`, desc: isMe ? (pDesc2?.own ?? '') : (pDesc2?.opp ?? ''), byMe: isMe }])
        setTimeout(() => setPowerNotifs(prev => prev.filter(n => n.id !== nid2)), 2500)
        playRef.current(isMe ? 'power_used_me' : 'power_used_opp')
        return
      }

      if (msg.type === 'second_life_consumed') {
        const isMe = msg.playerId === myId
        const setter = isMe ? setMyHighlights : setOppHighlights
        setter(h => ({ ...h, secondLife: 'activated' }))
        setTimeout(() => setter(h => { const n = { ...h }; delete n.secondLife; return n }), 1000)
        const slLabel = POWER_UP_LABELS.secondLife
        const slDesc = isMe ? (POWER_DESC.secondLife?.own ?? '') : (POWER_DESC.secondLife?.opp ?? '')
        const nid3 = ++notifIdRef.current
        setPowerNotifs(prev => [...prev, { id: nid3, emoji: slLabel.emoji, title: `${isMe ? 'You' : 'Opponent'} activated ${slLabel.name}`, desc: slDesc, byMe: isMe }])
        setTimeout(() => setPowerNotifs(prev => prev.filter(n => n.id !== nid3)), 2500)
        playRef.current(isMe ? 'power_used_me' : 'power_used_opp')
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
        setActiveToast({ id: ++toastIdRef.current, variant: 'danger_zone' })
        playRef.current('danger_zone')
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
        const isMe = msg.byPlayerId === myId
        const swapLabel = POWER_UP_LABELS.swap
        const swapDesc = isMe ? (POWER_DESC.swap?.own ?? '') : (POWER_DESC.swap?.opp ?? '')
        const swapId = ++notifIdRef.current
        setPowerNotifs(prev => [...prev, { id: swapId, emoji: swapLabel.emoji, title: `${isMe ? 'You' : 'Opponent'} activated ${swapLabel.name}`, desc: swapDesc, byMe: isMe }])
        setTimeout(() => setPowerNotifs(prev => prev.filter(n => n.id !== swapId)), 2500)
        playRef.current(isMe ? 'power_used_me' : 'power_used_opp')
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
          if (chainGrew && prevRound && prevRound.currentPlayerId !== myId) {
            const oppId = state.player1Id === myId ? state.player2Id : state.player1Id
            const diff = (newRound.playerRoundScores[oppId] ?? 0) - (prevRound.playerRoundScores[oppId] ?? 0)
            if (diff > 0) {
              const id = ++floatIdRef.current
              setFloats(prev => [...prev, { id, text: `+${diff}`, ok: true, byMe: false }])
              setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 2000)
            }
          }
        }

        prevStateRef.current = state
        setRoundHistory(msg.roundHistory ?? [])
        setGameScores(msg.scores ?? {})
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

  // Auto-scroll chain to the latest word whenever chain grows
  useEffect(() => {
    const el = chainScrollRef.current
    if (!el) return
    el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' })
  }, [matchState?.currentRound?.chain.length])

  // Sound: turn change
  const prevTurnPlayerRef = useRef<string | null>(null)
  useEffect(() => {
    if (!matchState?.currentRound || !myId) return
    const curr = matchState.currentRound.currentPlayerId
    if (prevTurnPlayerRef.current !== null && curr !== prevTurnPlayerRef.current) {
      playRef.current(curr === myId ? 'turn_start' : 'opp_turn')
    }
    prevTurnPlayerRef.current = curr
  }, [matchState?.currentRound?.currentPlayerId, myId])

  // Sound: round/match end
  const prevStatusRef = useRef<string | null>(null)
  useEffect(() => {
    if (!matchState) return
    const s = matchState.status
    if (s !== prevStatusRef.current) {
      if (s === 'round_complete') playRef.current('round_win')
      if (s === 'match_complete') playRef.current(matchState.matchWinnerId === myId ? 'match_win' : 'round_win')
    }
    prevStatusRef.current = s
  }, [matchState?.status, matchState?.matchWinnerId, myId])

  // Sound: time warn at 3s
  const timeWarnFiredRef = useRef(false)
  useEffect(() => {
    if (matchState?.status !== 'round_active') { timeWarnFiredRef.current = false; return }
    if (timeLeft <= 3 && !timeWarnFiredRef.current) {
      timeWarnFiredRef.current = true
      playRef.current('time_warn')
      setActiveToast({ id: ++toastIdRef.current, variant: 'time_warn' })
    }
    if (timeLeft > 3) timeWarnFiredRef.current = false
  }, [timeLeft, matchState?.status])

  const submitWord = useCallback(() => {
    const word = wordInput.trim().toLowerCase()
    if (!word || submitting || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'submit_word', word }))
    setSubmitting(true)
  }, [wordInput, submitting])

  const handleGameKey = useCallback((key: string) => {
    if (key === 'ENTER') { submitWord(); return }
    setWordInput(prev => {
      const next = key === 'BACKSPACE' ? prev.slice(0, -1) : prev + key.toLowerCase()
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'typing_update', partial: next }))
      }
      return next
    })
  }, [submitWord])

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
    playRef.current('reaction')
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
        <Button variant="secondary" onClick={() => { window.location.href = '/' }}>Back to lobby</Button>
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
    const isBotMatch = opponentId === 'bot'

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
          {!isBotMatch && (rematchState === 'idle' ? (
            <Button variant="primary" size="lg" full onClick={sendRematchRequest}>Rematch</Button>
          ) : (
            <div style={{ height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '1px solid var(--n200)', borderRadius: 'var(--radius-md)', background: 'var(--n0)' }}>
              <div style={{ width: '14px', height: '14px', border: '2px solid var(--n300)', borderTopColor: 'var(--n700)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: '13px', color: 'var(--n500)' }}>Waiting for opponent…</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ))}
          <Button variant={isBotMatch ? 'primary' : 'secondary'} size="lg" full onClick={() => { window.location.href = '/' }}>Back to lobby</Button>
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
          {/* 5-round progress dots */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: '20px' }}>
            {[1, 2, 3, 4, 5].map(r => {
              const myWon = r <= myWins
              const oppWon = r <= oppWins && r > myWins
              const isCurrent = r === (ctx?.roundNumber ?? 0)
              return (
                <div key={r} style={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)', background: myWon ? 'var(--p1-light)' : oppWon ? 'var(--p2-light)' : 'var(--n100)', color: myWon ? 'var(--p1)' : oppWon ? 'var(--p2)' : 'var(--n400)', border: `1px solid ${isCurrent ? (iWonRound ? 'var(--p1)' : 'var(--p2)') : 'transparent'}`, opacity: r > (ctx?.roundNumber ?? 0) ? 0.4 : 1 }}>
                  {r <= (ctx?.roundNumber ?? 0) ? (myWon ? 'W' : 'L') : r}
                </div>
              )
            })}
          </div>

          <Button variant="primary" size="lg" full onClick={sendNextRoundRequest} disabled={iConfirmed}>
            {iConfirmed ? 'Ready ✓' : 'Play Again'}
          </Button>
          <Button variant="secondary" size="lg" full onClick={() => { window.location.href = '/' }}>Back to Lobby</Button>

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
  const opponentName = opponentId === 'bot' ? 'Bot' : 'Opponent'
  const myWins = matchState.roundWins[myId] ?? 0
  const oppWins = matchState.roundWins[opponentId] ?? 0
  const myFaults = round.faults[myId] ?? 0
  const oppFaults = round.faults[opponentId] ?? 0
  const gameMode: GameMode = matchState.gameMode ?? 'classic'
  const modeCfg = MODE_CONFIG[gameMode]
  const emptyInv: PowerUpInventory = { freeze: 0, secondLife: 0, letterBomb: 0, block: 0, swap: 0, blind: 0, shrink: 0, rush: 0, steal: 0, peek: 0, blitz: 0, wildfire: 0 }
  const myInventory: PowerUpInventory = round.powerUpInventory[myId] ?? emptyInv
  const opponentInventory: PowerUpInventory = round.powerUpInventory[opponentId] ?? emptyInv
  const blindOnMe = round.activeEffects.find(e => e.kind === 'blind' && e.onPlayerId === myId)
  const swapPending = round.activeEffects.find(e => e.kind === 'swapPending' && e.byPlayerId === myId)
  const inDangerZone = round.chain.length >= 20
  const timerPct = (timeLeft / modeCfg.turnSeconds) * 100
  const timerUrgent = timeLeft <= 5 || inDangerZone
  const lastWord = round.chain[round.chain.length - 1]
  const nextSeed = lastWord ? lastWord.slice(-1).toUpperCase() : round.seedLetter.toUpperCase()

  const myRoundScore = round.playerRoundScores[myId] ?? 0
  const oppRoundScore = round.playerRoundScores[opponentId] ?? 0
  const myGameScore = gameScores[myId] ?? 0
  const oppGameScore = gameScores[opponentId] ?? 0

  const oppEffectChips: string[] = round.activeEffects.flatMap(e => {
    if (e.kind === 'letterBomb' && e.onPlayerId === opponentId) return [`💣 ${e.requiredLetter}`]
    if (e.kind === 'shrink'     && e.onPlayerId === opponentId) return [`🤏 ≤${e.maxLength}`]
    if (e.kind === 'rush'       && e.onPlayerId === opponentId) return ['⚡ Rush']
    if (e.kind === 'blind'      && e.onPlayerId === opponentId) return [`🙈 ${e.turnsRemaining}T`]
    if (e.kind === 'freeze'     && e.onPlayerId === opponentId) return ['❄️ Frozen']
    return []
  })

  const myEffectChips: string[] = round.activeEffects.flatMap(e => {
    if (e.kind === 'letterBomb'    && e.onPlayerId === myId)    return [`💣 ${e.requiredLetter}`]
    if (e.kind === 'shrink'        && e.onPlayerId === myId)    return [`🤏 ≤${e.maxLength}`]
    if (e.kind === 'rush'          && e.onPlayerId === myId)    return ['⚡ Rush']
    if (e.kind === 'blind'         && e.onPlayerId === myId)    return ['🙈 Hidden']
    if (e.kind === 'freeze'        && e.onPlayerId === myId)    return ['❄️ Frozen']
    if (e.kind === 'secondLifeArmed' && e.forPlayerId === myId) return ['💚 Armed']
    if (e.kind === 'peek'          && e.forPlayerId === myId)   return [`👁 ${opponentTyping || '…'}`]
    if (e.kind === 'blitzClaimed'  && e.byPlayerId === myId)    return ['⚔️ Blitz x2']
    if (e.kind === 'wildfire')                                  return [`🔥 3×·${e.turnsRemaining}T`]
    return []
  })

  return (
    <div id="game-root" style={S.page}>
      {/* Mute toggle */}
      <button
        onClick={() => setMuted(!muted)}
        style={{ position: 'fixed', top: 8, right: 8, zIndex: 70, background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '4px', lineHeight: 1, color: 'var(--n400)', opacity: 0.7 }}
        title={muted ? 'Unmute' : 'Mute'}
        aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
      >
        {muted ? '🔇' : '🔊'}
      </button>

      {/* Game header */}
      <div style={{ background: 'var(--n0)', borderBottom: '1px solid var(--n200)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <button
          onClick={() => { window.location.href = '/' }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--n400)', padding: '4px', lineHeight: 1 }}
          aria-label="Back to lobby"
        >←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-heading)', color: 'var(--n900)' }}>{modeCfg.displayName}</div>
          <div style={{ fontSize: '11px', color: 'var(--n400)', fontFamily: 'var(--font-mono)' }}>Round {round.roundNumber}</div>
        </div>
      </div>

      {/* Danger Zone strip */}
      {inDangerZone && (
        <div style={{ background: 'var(--danger-zone-bg)', borderBottom: '1px solid var(--danger-zone)', padding: '6px 14px', fontSize: '11px', color: 'var(--danger-zone)', textAlign: 'center', flexShrink: 0, fontWeight: 700, letterSpacing: '0.04em' }}>
          DANGER ZONE — 3× scoring · 5s timer
        </div>
      )}

      {/* Notification overlay — power notifs + toast, all centered top */}
      {(powerNotifs.length > 0 || activeToast) && (
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
          {activeToast && (
            <div style={{ pointerEvents: 'auto', width: '100%', maxWidth: 260 }}>
              <GameToast
                key={activeToast.id}
                variant={activeToast.variant}
                subText={activeToast.subText}
                onDismiss={() => setActiveToast(null)}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Players row ── */}
      <div style={{ background: 'var(--n0)', borderBottom: '1px solid var(--n100)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {/* Me */}
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
              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--p1)' }}>{myRoundScore}</span>
            </div>
            {myEffectChips.length > 0 && (
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {myEffectChips.map((chip, i) => (
                  <span key={i} style={{ fontSize: 9, background: 'var(--accent-warm-faint)', color: 'var(--accent-warm-muted)', padding: '1px 5px', borderRadius: '99px', fontWeight: 500 }}>{chip}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--n800)', lineHeight: 1 }}>{myWins} – {oppWins}</div>
          <div style={{ fontSize: 9, color: 'var(--n400)', letterSpacing: '0.06em', fontWeight: 600, marginTop: 2 }}>ROUNDS</div>
        </div>

        {/* Opponent */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
          <div style={{ minWidth: 0, flex: 1, textAlign: 'right' }}>
            <p style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-heading)', color: 'var(--n800)', margin: '0 0 2px' }}>
              {!isMyTurn && <span style={{ color: 'var(--p2)', fontWeight: 500 }}>{opponentTyping ? 'typing… · ' : 'thinking… · '}</span>}{opponentName}
            </p>
            <div style={{ margin: '0 0 3px', textAlign: 'right' }}>
              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--p2)' }}>{oppRoundScore}</span>
            </div>
            {oppEffectChips.length > 0 && (
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {oppEffectChips.map((chip, i) => (
                  <span key={i} style={{ fontSize: 9, background: 'var(--accent-warm-faint)', color: 'var(--accent-warm-muted)', padding: '1px 5px', borderRadius: '99px', fontWeight: 500 }}>{chip}</span>
                ))}
              </div>
            )}
          </div>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Avatar name="?" variant="p2" size={30} />
            {!isMyTurn && <div style={{ position: 'absolute', bottom: -2, right: -2, width: 9, height: 9, borderRadius: '50%', background: 'var(--p2)', border: '2px solid var(--n0)' }} />}
          </div>
        </div>
      </div>

      {/* ── Power-ups row ── */}
      <div style={{ background: 'var(--n50, #f9fafb)', borderBottom: '1px solid var(--n100)', padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 4, flex: 1, flexWrap: 'wrap' }}>
          {(Object.keys(POWER_UP_LABELS) as PowerUpId[]).map(id => {
            const count = myInventory[id] ?? 0
            const hl = myHighlights[id]
            return (
              <PowerUpTooltip key={id} id={id} description={POWER_DESC[id].own}>
                <span
                  style={{ fontSize: 11, opacity: count > 0 ? 1 : 0.15, lineHeight: 1.2, position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 1, padding: '1px 2px', animation: hl === 'earned' ? 'earnGlow 0.8s ease-out' : hl === 'activated' ? 'activateFlash 0.6s ease-out' : 'none' }}>
                  {POWER_UP_LABELS[id].emoji}
                  {count > 0 && <span style={{ fontSize: 7, fontFamily: 'var(--font-mono)', color: 'var(--p1)', fontWeight: 700, lineHeight: 1 }}>{count}</span>}
                </span>
              </PowerUpTooltip>
            )
          })}
        </div>
        <span style={{ fontSize: 9, color: 'var(--n300)', fontFamily: 'var(--font-mono)', fontWeight: 600, flexShrink: 0 }}>PWR</span>
        <div style={{ display: 'flex', gap: 4, flex: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {(Object.keys(POWER_UP_LABELS) as PowerUpId[]).map(id => {
            const count = opponentInventory[id] ?? 0
            const hl = oppHighlights[id]
            return (
              <PowerUpTooltip key={id} id={id} description={POWER_DESC[id].opp}>
                <span
                  style={{ fontSize: 11, opacity: count > 0 ? 1 : 0.15, lineHeight: 1.2, position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 1, padding: '1px 2px', animation: hl === 'earned' ? 'earnGlow 0.8s ease-out' : hl === 'activated' ? 'activateFlash 0.6s ease-out' : 'none' }}>
                  {POWER_UP_LABELS[id].emoji}
                  {count > 0 && <span style={{ fontSize: 7, fontFamily: 'var(--font-mono)', color: 'var(--p2)', fontWeight: 700, lineHeight: 1 }}>{count}</span>}
                </span>
              </PowerUpTooltip>
            )
          })}
        </div>
      </div>

      {/* ── Word chain + floating reaction FAB ── */}
      <div style={{ flex: 1, padding: `12px 16px ${gameMode === 'classic' ? 52 : 12}px`, display: 'flex', flexWrap: 'wrap', gap: 6, alignContent: 'flex-start', overflow: 'hidden', position: 'relative' }}>
        {blindOnMe && blindOnMe.kind === 'blind' ? (
          <div style={{ width: '100%', textAlign: 'center', color: 'var(--n400)', paddingTop: 20 }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>🙈</div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Chain hidden</div>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{(blindOnMe as { kind: 'blind'; onPlayerId: string; turnsRemaining: number }).turnsRemaining}T left</div>
          </div>
        ) : round.chain.length === 0 ? (
          <div style={{ width: '100%', textAlign: 'center', paddingTop: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--n400)', marginBottom: 6 }}>Start with</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 40, color: 'var(--n900)' }}>{round.seedLetter.toUpperCase()}</div>
          </div>
        ) : (
          <>
            {round.chain.slice(-8).map((word, i, arr) => {
              const absIdx = round.chain.length - arr.length + i
              const isOwn = matchState.player1Id === myId ? absIdx % 2 === 0 : absIdx % 2 !== 0
              return (
                <WordPill key={absIdx} word={word} variant={isOwn ? 'player1' : 'player2'} size="sm" />
              )
            })}
            {!isMyTurn && (
              <span style={{ fontSize: 12, color: 'var(--n400)', fontFamily: 'var(--font-mono)', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'var(--n100)', borderRadius: 'var(--radius-full)', border: '1px dashed var(--n300)' }}>
                {opponentTyping || nextSeed.toLowerCase()}<span style={{ animation: 'blink 1s step-end infinite', opacity: 0.5 }}>|</span>
              </span>
            )}
          </>
        )}

        {/* Floating reaction FAB — sits above the powers strip */}
        <div style={{ position: 'absolute', bottom: gameMode === 'classic' ? 58 : 10, right: 14, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          {reactionsOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--n0)', border: '1px solid var(--n200)', borderRadius: 'var(--radius-xl)', padding: '6px 4px', boxShadow: '0 4px 16px rgba(0,0,0,0.10)' }}>
              {REACTION_OPTIONS.map(r => (
                <button key={r.key} onClick={() => { sendReaction(r.key); setReactionsOpen(false) }}
                  style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', padding: '3px 6px', borderRadius: 'var(--radius-md)', lineHeight: 1 }}>
                  {r.emoji}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setReactionsOpen(o => !o)}
            style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--n0)', border: '1px solid var(--n200)', boxShadow: '0 2px 8px rgba(0,0,0,0.10)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.15s', transform: reactionsOpen ? 'rotate(45deg)' : 'none' }}>
            {reactionsOpen ? '✕' : '😊'}
          </button>
        </div>

        {/* Powers strip — classic mode, always visible at bottom of chain area */}
        {gameMode === 'classic' && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--n0)', borderTop: '1px solid var(--n100)', padding: '6px 10px', display: 'flex', gap: 4, alignItems: 'center', overflowX: 'auto', msOverflowStyle: 'none' } as React.CSSProperties}>
            {(Object.keys(POWER_UP_LABELS) as PowerUpId[]).map(id => {
              const count = myInventory[id] ?? 0
              const earned = count > 0
              const turnLocked = !isMyTurn && id !== 'secondLife' && id !== 'block'
              const hl = myHighlights[id]
              return (
                <PowerUpTooltip key={id} id={id} description={POWER_DESC[id].own}>
                  <button
                    disabled={!earned || turnLocked}
                    onClick={() => activatePowerUp(id)}
                    style={{ position: 'relative', background: 'none', border: 'none', padding: '2px 3px', cursor: earned && !turnLocked ? 'pointer' : 'default', opacity: earned ? (turnLocked ? 0.5 : 1) : 0.2, filter: earned ? 'none' : 'grayscale(1)', flexShrink: 0, animation: hl === 'earned' ? 'earnGlow 0.8s ease-out' : hl === 'activated' ? 'activateFlash 0.6s ease-out' : 'none' }}>
                    <span style={{ fontSize: 22, lineHeight: 1 }}>{POWER_UP_LABELS[id].emoji}</span>
                    {earned && (
                      <span style={{ position: 'absolute', top: 0, right: 0, fontSize: 8, fontFamily: 'var(--font-mono)', background: 'var(--p1)', color: 'var(--n0)', borderRadius: '99px', padding: '1px 3px', fontWeight: 700, lineHeight: 1 }}>×{count}</span>
                    )}
                  </button>
                </PowerUpTooltip>
              )
            })}
          </div>
        )}

        {/* Floating reactions feed */}
        {reactionFeed.length > 0 && (
          <div style={{ position: 'absolute', top: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 8, pointerEvents: 'none' }}>
            {reactionFeed.map(r => (
              <div key={r.id} style={{ fontSize: 28, animation: 'reactionFloat 3s ease-out forwards' }}>{r.emoji}</div>
            ))}
          </div>
        )}

        {/* Score / word floats */}
        {floats.filter(f => f.byMe).length > 0 && (
          <div style={{ position: 'absolute', bottom: 8, left: 14, display: 'flex', flexDirection: 'column-reverse', gap: 4, pointerEvents: 'none' }}>
            {floats.filter(f => f.byMe).map(f => (
              <div key={f.id} style={{ fontSize: 15, fontWeight: 700, fontFamily: f.ok ? 'var(--font-mono)' : 'var(--font-body)', color: f.ok ? 'var(--p1)' : 'var(--danger)', animation: 'scoreFloat 2s ease-out forwards', whiteSpace: 'nowrap' }}>
                {f.text}
              </div>
            ))}
          </div>
        )}
        {floats.filter(f => !f.byMe).length > 0 && (
          <div style={{ position: 'absolute', bottom: 8, right: 14, display: 'flex', flexDirection: 'column-reverse', gap: 4, alignItems: 'flex-end', pointerEvents: 'none' }}>
            {floats.filter(f => !f.byMe).map(f => (
              <div key={f.id} style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--p2)', animation: 'scoreFloat 2s ease-out forwards' }}>
                {f.text}
              </div>
            ))}
          </div>
        )}

        <style>{`
          html, body { overflow: hidden; max-width: 100vw; overscroll-behavior: none; }
          #game-root * { -webkit-user-select: none; user-select: none; }
          #game-root input { -webkit-user-select: text; user-select: text; }
          @keyframes blink { 50% { opacity: 0; } }
          @keyframes reactionFloat { 0% { opacity: 0; transform: translateY(20px); } 20% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-40px); } }
          @keyframes scoreFloat { 0% { opacity: 0; transform: translateY(0); } 15% { opacity: 1; transform: translateY(-8px); } 100% { opacity: 0; transform: translateY(-60px); } }
          @keyframes wordShimmer { 0% { filter: brightness(1.6) saturate(1.5); transform: scale(1.05); } 100% { filter: brightness(1) saturate(1); transform: scale(1); } }
          @keyframes earnGlow { 0% { box-shadow: 0 0 0 2px #4caf50; } 60% { box-shadow: 0 0 8px 4px #4caf5088; } 100% { box-shadow: 0 0 0 2px #4caf50; } }
          @keyframes activateFlash { 0% { background: var(--accent-warm-faint); } 50% { background: #ffe09a; } 100% { background: var(--n0); } }
          @keyframes notifFade { 0% { opacity: 0; transform: translateY(-4px); } 15% { opacity: 1; transform: translateY(0); } 85% { opacity: 1; } 100% { opacity: 0; } }
        `}</style>
      </div>

      {/* ── Bottom panel ── */}
      <div style={{ background: 'var(--n0)', borderTop: `1px solid ${inDangerZone ? 'var(--danger-zone)' : 'var(--n200)'}`, padding: '10px 14px 20px', flexShrink: 0 }}>

        {/* Timer */}
        <div style={{ marginBottom: 10 }}>
          <TimerBar percent={timerPct} danger={timerUrgent} label={`${Math.ceil(timeLeft)}s`} />
        </div>


        {/* Turn label + word count */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          {isMyTurn ? (
            <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-heading)', color: inDangerZone ? 'var(--danger-zone)' : 'var(--p1)' }}>
              Word starting with <strong>{nextSeed}</strong>
            </span>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--n400)', fontFamily: 'var(--font-body)' }}>Waiting for opponent…</span>
          )}
          <span style={{ fontSize: 11, color: 'var(--n400)', fontFamily: 'var(--font-mono)' }}>{round.chain.length} words</span>
        </div>

        {/* Swap letter picker */}
        {swapPending && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--n700)', marginBottom: 4, fontWeight: 600 }}>🔀 Pick new chain letter:</div>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {'abcdefghijklmnopqrstuvwxyz'.split('').map(letter => (
                <button key={letter} onClick={() => { if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: 'swap_choose_letter', letter })) }}
                  style={{ width: 24, height: 24, borderRadius: 'var(--radius-sm)', border: '1px solid var(--n200)', background: 'var(--n0)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer', textTransform: 'uppercase' }}>{letter}</button>
              ))}
            </div>
          </div>
        )}

        {/* Input row */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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
            onKeyDown={e => {
              if (e.key === 'Enter') { submitWord(); return }
              if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key.length === 1 || e.key === 'Backspace')) play('tap')
            }}
            disabled={!isMyTurn || submitting}
            placeholder={isMyTurn ? (round.chain.length === 0 ? `Start with ${round.seedLetter.toUpperCase()}…` : `${nextSeed}…`) : 'Waiting…'}
            autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
            inputMode={isMobile ? 'none' : 'text'} enterKeyHint="send"
            style={{ ...S.input, fontSize: 13, padding: '7px 10px', opacity: !isMyTurn || submitting ? 0.45 : 1, cursor: !isMyTurn || submitting ? 'not-allowed' : 'text' }}
          />
          <Button variant="primary" size="sm" onClick={submitWord} disabled={!isMyTurn || submitting || !wordInput.trim()}>
            {submitting ? '…' : '→'}
          </Button>
          {isMobile && (
            <button
              onClick={() => setKeyboardVisible(v => !v)}
              disabled={!isMyTurn}
              style={{ background: keyboardVisible && isMyTurn ? 'var(--n900)' : 'var(--n100)', border: '1px solid var(--n200)', borderRadius: 'var(--radius-md)', padding: '6px 8px', fontSize: 15, lineHeight: 1, cursor: isMyTurn ? 'pointer' : 'default', opacity: isMyTurn ? 1 : 0.4, color: keyboardVisible && isMyTurn ? 'var(--n0)' : 'var(--n600)', flexShrink: 0 }}
              aria-label={keyboardVisible ? 'Hide keyboard' : 'Show keyboard'}
            >⌨</button>
          )}
        </div>
      </div>

      {/* Game keyboard — mobile only, shown on my turn when visible */}
      {isMobile && isMyTurn && keyboardVisible && (
        <GameKeyboard onKey={handleGameKey} disabled={submitting} />
      )}
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
