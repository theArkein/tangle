'use client'

import { Suspense, useState, useEffect, useRef, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
import { useSearchParams, useRouter } from 'next/navigation'

// ── Backend types (mirrored from src/modules/MatchStateMachine.ts) ───────────

interface RoundState {
  roundNumber: number
  seedLetter: string
  chain: string[]
  currentPlayerId: string
  faults: Record<string, number>
  roundWinnerId?: string
}

interface MatchState {
  status: 'waiting' | 'round_active' | 'round_complete' | 'match_complete'
  player1Id: string
  player2Id: string
  roundWins: Record<string, number>
  currentRound?: RoundState
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
  | { type: 'waiting'; playerCount: number }
  | { type: 'word_result'; valid: true; points: number; breakdown: { base: number; rareLetter: number; longWord: number } }
  | { type: 'word_result'; valid: false; reason: string }
  | { type: 'opponent_disconnected' }
  | { type: 'rematch_pending' }
  | { type: 'rematch_timeout' }
  | { type: 'error'; message: string }

// ── Constants ────────────────────────────────────────────────────────────────

const TURN_SECONDS = 15
const MAX_FAULTS = 3
const ROUND_END_MS = 2500

// ── Game screen ──────────────────────────────────────────────────────────────

function GameContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const roomId = searchParams.get('room') ?? ''

  const [myId, setMyId] = useState<string | null>(null)
  const [matchState, setMatchState] = useState<MatchState | null>(null)
  const [waitingCount, setWaitingCount] = useState<number | null>(null)
  const [disconnected, setDisconnected] = useState(false)
  const [wordInput, setWordInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null)
  const [turnStartAt, setTurnStartAt] = useState(Date.now())
  const [timeLeft, setTimeLeft] = useState(TURN_SECONDS)
  const [roundEnd, setRoundEnd] = useState<{ roundNumber: number; winnerId: string } | null>(null)
  const [roundHistory, setRoundHistory] = useState<RoundHistoryEntry[]>([])
  const [rematchState, setRematchState] = useState<'idle' | 'pending'>('idle')
  const [showLinkPrompt, setShowLinkPrompt] = useState(false)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const deferredInstallRef = useRef<BeforeInstallPromptEvent | null>(null)
  const prevStateRef = useRef<MatchState | null>(null)
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load current player ID
  useEffect(() => {
    if (!roomId) return
    fetch('/api/me')
      .then(r => r.json())
      .then((d: { id: string }) => setMyId(d.id))
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

      if (msg.type === 'state_update') {
        const { state } = msg
        const prev = prevStateRef.current
        const prevRound = prev?.currentRound
        const newRound = state.currentRound

        // Reset rematch button state when a new match starts
        if (state.status === 'match_complete') {
          setRematchState('idle')
        }

        // Detect round transition: show brief overlay with who won the just-finished round
        if (
          state.status !== 'match_complete' &&
          prevRound &&
          newRound &&
          newRound.roundNumber > prevRound.roundNumber
        ) {
          let winnerId = ''
          for (const [pid, wins] of Object.entries(state.roundWins)) {
            if ((wins ?? 0) > (prev?.roundWins[pid] ?? 0)) {
              winnerId = pid
              break
            }
          }
          setRoundEnd({ roundNumber: prevRound.roundNumber, winnerId })
          setTimeout(() => setRoundEnd(null), ROUND_END_MS)
        }

        // Reset visual timer when a new turn starts (chain grows or new round)
        if (newRound) {
          const chainGrew = newRound.chain.length > (prevRound?.chain.length ?? -1)
          const roundChanged = newRound.roundNumber !== prevRound?.roundNumber
          const firstUpdate = !prevRound
          if (chainGrew || roundChanged || firstUpdate) {
            setTurnStartAt(Date.now())
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
    const id = setInterval(() => {
      setTimeLeft(Math.max(0, TURN_SECONDS - (Date.now() - turnStartAt) / 1000))
    }, 250)
    return () => clearInterval(id)
  }, [matchState?.status, turnStartAt])

  const submitWord = useCallback(() => {
    const word = wordInput.trim().toLowerCase()
    if (!word || submitting || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'submit_word', word }))
    setSubmitting(true)
    setFeedback(null)
  }, [wordInput, submitting])

  // Show Google link prompt once after first match win (mobile only)
  useEffect(() => {
    if (
      matchState?.status === 'match_complete' &&
      matchState.matchWinnerId === myId &&
      !localStorage.getItem('link_prompt_dismissed') &&
      typeof window !== 'undefined' &&
      /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
    ) {
      setShowLinkPrompt(true)
    }
  }, [matchState?.status, matchState?.matchWinnerId, myId])

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
      setShowInstallPrompt(true)
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
      <div className="flex flex-col min-h-full items-center justify-center gap-4 px-4 text-center">
        <p className="text-xl font-semibold">Opponent disconnected</p>
        <p className="text-sm text-zinc-500">The game has ended</p>
        <button
          onClick={() => router.push('/')}
          className="mt-2 h-10 px-6 rounded-full border border-black/[.08] dark:border-white/[.08] text-sm font-medium transition-colors hover:bg-black/[.04] dark:hover:bg-white/[.04]"
        >
          Back to lobby
        </button>
      </div>
    )
  }

  // ── Waiting for opponent ─────────────────────────────────────────────────

  if (!matchState && waitingCount !== null) {
    return (
      <div className="flex flex-col min-h-full items-center justify-center gap-4 px-4 text-center">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground opacity-20" />
          <span className="relative inline-flex h-10 w-10 rounded-full bg-foreground opacity-80" />
        </div>
        <p className="text-lg font-semibold">Waiting for opponent…</p>
        <p className="text-sm text-zinc-500">{waitingCount}/2 players connected</p>
      </div>
    )
  }

  // ── Loading ──────────────────────────────────────────────────────────────

  if (!matchState || !myId) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    )
  }

  // ── Match complete — result screen ───────────────────────────────────────

  if (matchState.status === 'match_complete') {
    const won = matchState.matchWinnerId === myId
    const opponentId = matchState.player1Id === myId ? matchState.player2Id : matchState.player1Id

    return (
      <div className="flex flex-col min-h-full bg-background text-foreground">
        {/* Result header */}
        <header className="flex-none px-4 pt-8 pb-5 text-center border-b border-black/[.08] dark:border-white/[.08]">
          <p className="text-5xl mb-3">{won ? '🏆' : '😔'}</p>
          <p className="text-2xl font-bold">{won ? 'You win!' : 'You lose'}</p>
          <p className="mt-1 text-sm text-zinc-500">
            {matchState.roundWins[myId] ?? 0} – {matchState.roundWins[opponentId] ?? 0} rounds
          </p>
        </header>

        {/* Round replay */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
          {roundHistory.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-4">No round data available</p>
          ) : (
            roundHistory.map(rh => (
              <div key={rh.roundNumber}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Round {rh.roundNumber}
                  </span>
                  <span className="text-xs text-zinc-400">
                    · {rh.winnerId === myId ? 'You won' : 'Opponent won'}
                  </span>
                </div>
                {rh.words.length === 0 ? (
                  <p className="text-sm text-zinc-400 italic pl-1">No words played</p>
                ) : (
                  <ol className="flex flex-col gap-1">
                    {rh.words.map((entry, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-2 text-sm rounded-lg px-2 py-1.5"
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full flex-none ${
                            entry.playerId === myId ? 'bg-blue-500' : 'bg-zinc-400'
                          }`}
                        />
                        <span className="font-medium flex-1 min-w-0 truncate">{entry.word}</span>
                        {entry.breakdown.rareLetter > 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium">
                            rare
                          </span>
                        )}
                        {entry.breakdown.longWord > 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded-md bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 font-medium">
                            long
                          </span>
                        )}
                        <span className="text-xs tabular-nums text-zinc-500 ml-auto">
                          +{entry.points}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ))
          )}
        </div>

        {/* Google link prompt — shown once on mobile after first win */}
        {showLinkPrompt && (
          <div className="flex-none mx-4 mb-2 rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-background px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Save your progress</p>
              <p className="text-xs text-zinc-500">Link Google to recover your account on any device</p>
            </div>
            <a
              href="/api/auth/google"
              className="flex-none text-xs font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap"
            >
              Link
            </a>
            <button
              onClick={() => {
                localStorage.setItem('link_prompt_dismissed', '1')
                setShowLinkPrompt(false)
              }}
              className="flex-none text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="flex-none border-t border-black/[.08] dark:border-white/[.08] px-4 pt-4 pb-8 space-y-3">
          {rematchState === 'idle' ? (
            <button
              onClick={sendRematchRequest}
              className="h-12 w-full rounded-2xl bg-foreground text-background text-sm font-semibold transition-opacity hover:opacity-80 active:opacity-60"
            >
              Rematch
            </button>
          ) : (
            <div className="h-12 w-full rounded-2xl border border-black/[.08] dark:border-white/[.08] flex items-center justify-center gap-2">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
              <span className="text-sm text-zinc-500">Waiting for opponent…</span>
            </div>
          )}
          <button
            onClick={() => router.push('/')}
            className="h-10 w-full rounded-2xl border border-black/[.08] dark:border-white/[.08] text-sm font-medium transition-colors hover:bg-black/[.04] dark:hover:bg-white/[.04]"
          >
            Back to lobby
          </button>
          {showInstallPrompt && (
            <button
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
              className="h-10 w-full rounded-2xl border border-black/[.08] dark:border-white/[.08] text-sm font-medium transition-colors hover:bg-black/[.04] dark:hover:bg-white/[.04]"
            >
              Add to Home Screen
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Round active ─────────────────────────────────────────────────────────

  const round = matchState.currentRound
  if (!round) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    )
  }

  const isMyTurn = round.currentPlayerId === myId
  const opponentId = matchState.player1Id === myId ? matchState.player2Id : matchState.player1Id
  const myWins = matchState.roundWins[myId] ?? 0
  const oppWins = matchState.roundWins[opponentId] ?? 0
  const myFaults = round.faults[myId] ?? 0
  const timerPct = timeLeft / TURN_SECONDS
  const timerUrgent = timeLeft <= 5

  return (
    <div className="flex flex-col min-h-full bg-background text-foreground">
      {/* Round-end overlay */}
      {roundEnd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-background px-10 py-8 text-center shadow-lg">
            <p className="text-sm font-medium text-zinc-500 mb-1">Round {roundEnd.roundNumber} over</p>
            <p className="text-xl font-bold">
              {roundEnd.winnerId === myId ? 'You won this round!' : 'Opponent won this round'}
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-black/[.08] dark:border-white/[.08]">
        {/* Round wins */}
        <div className="flex items-center gap-2 min-w-[64px]">
          <span className="text-2xl font-bold tabular-nums">{myWins}</span>
          <span className="text-zinc-400">–</span>
          <span className="text-2xl font-bold tabular-nums">{oppWins}</span>
        </div>

        {/* Round label */}
        <span className="text-sm font-medium text-zinc-500">Round {round.roundNumber}</span>

        {/* Countdown */}
        <div className={`flex items-center gap-1.5 min-w-[64px] justify-end ${timerUrgent ? 'text-red-500' : ''}`}>
          {/* Progress bar */}
          <div className="h-1.5 w-10 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${timerUrgent ? 'bg-red-500' : 'bg-foreground'}`}
              style={{ width: `${timerPct * 100}%` }}
            />
          </div>
          <span className="text-lg font-bold tabular-nums w-6 text-right">
            {Math.ceil(timeLeft)}
          </span>
        </div>
      </header>

      {/* Word chain */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {round.chain.length === 0 ? (
          <div className="flex h-full min-h-[160px] items-center justify-center text-center">
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Start with</p>
              <p className="text-6xl font-bold uppercase tracking-tight">{round.seedLetter}</p>
            </div>
          </div>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {round.chain.map((word, i) => {
              const isLatest = i === round.chain.length - 1
              return (
                <li
                  key={i}
                  className={`flex items-baseline gap-0.5 rounded-xl px-3 py-2 text-sm ${
                    isLatest ? 'bg-foreground/[.06]' : ''
                  }`}
                >
                  <span className="font-bold text-blue-500 uppercase">{word[0]}</span>
                  <span className="font-medium">{word.slice(1)}</span>
                  {isLatest && word.length > 0 && (
                    <span className="ml-auto text-xs text-zinc-400">
                      → <span className="font-semibold text-blue-500 uppercase">{word[word.length - 1]}</span>
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </div>

      {/* Bottom panel */}
      <div className="border-t border-black/[.08] dark:border-white/[.08] px-4 pt-3 pb-5 space-y-3">
        {/* Turn + fault row */}
        <div className="flex items-center justify-between">
          <span className={`text-sm font-medium ${isMyTurn ? 'text-green-600 dark:text-green-400' : 'text-zinc-400'}`}>
            {isMyTurn ? 'Your turn' : "Opponent's turn"}
          </span>
          {isMyTurn && (
            <div className="flex items-center gap-1.5">
              {Array.from({ length: MAX_FAULTS }).map((_, i) => (
                <span
                  key={i}
                  className={`h-2 w-2 rounded-full ${
                    i < myFaults
                      ? 'bg-red-500'
                      : 'border border-black/20 dark:border-white/20'
                  }`}
                />
              ))}
              <span className="ml-1 text-xs text-zinc-500 tabular-nums">
                {MAX_FAULTS - myFaults}/{MAX_FAULTS}
              </span>
            </div>
          )}
        </div>

        {/* Inline feedback */}
        {feedback && (
          <p className={`text-sm font-medium ${feedback.ok ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
            {feedback.text}
          </p>
        )}

        {/* Input row */}
        <div className="flex gap-2">
          <input
            type="text"
            value={wordInput}
            onChange={e => setWordInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitWord() }}
            disabled={!isMyTurn || submitting}
            placeholder={
              isMyTurn
                ? `Word starting with ${round.seedLetter.toUpperCase()}…`
                : "Waiting for opponent…"
            }
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            className="flex-1 h-12 rounded-xl border border-black/[.08] dark:border-white/[.08] bg-transparent px-3 text-sm placeholder:text-zinc-400 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-foreground/20"
          />
          <button
            onClick={submitWord}
            disabled={!isMyTurn || submitting || !wordInput.trim()}
            className="h-12 px-5 rounded-xl bg-foreground text-background text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-opacity hover:opacity-80 active:opacity-60"
          >
            {submitting ? '…' : 'Send'}
          </button>
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
