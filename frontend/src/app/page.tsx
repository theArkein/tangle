'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface PlayerInfo {
  id: string
  display_name: string
  elo: number
}

type Phase = 'idle' | 'waiting'

export default function LobbyPage() {
  const router = useRouter()
  const [player, setPlayer] = useState<PlayerInfo | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [token, setToken] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json())
      .then(data => setPlayer(data as PlayerInfo))
      .catch(() => {})
  }, [])

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
        }
      } catch {}
    }, 2000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [phase, token, router])

  async function handlePlay() {
    const res = await fetch('/api/matchmake', { method: 'POST' })
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
    const url = `${window.location.origin}/join/${roomId}`
    await navigator.clipboard.writeText(url)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 3000)
  }

  return (
    <div className="flex flex-col min-h-full bg-background text-foreground">
      <header className="flex items-center justify-between px-4 py-3 border-b border-black/[.08] dark:border-white/[.08]">
        <span className="text-xl font-bold tracking-tight">Tangle</span>
        {player ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="font-medium">{player.display_name}</span>
            <span className="text-zinc-500">{player.elo} ELO</span>
          </div>
        ) : (
          <div className="h-4 w-28 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
        )}
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
        {phase === 'idle' && (
          <>
            <div className="text-center">
              <h1 className="text-3xl font-bold tracking-tight">Chain Battle</h1>
              <p className="mt-2 text-zinc-500 dark:text-zinc-400">Build the longest word chain to win</p>
            </div>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button
                onClick={handlePlay}
                className="h-14 rounded-2xl bg-foreground text-background text-lg font-semibold transition-opacity hover:opacity-80 active:opacity-60"
              >
                Play
              </button>
              <button
                onClick={handleChallengeFriend}
                className="h-12 rounded-2xl border border-black/[.08] dark:border-white/[.08] text-sm font-medium transition-colors hover:bg-black/[.04] dark:hover:bg-white/[.04]"
              >
                {linkCopied ? 'Link copied!' : 'Challenge a friend'}
              </button>
            </div>
          </>
        )}

        {phase === 'waiting' && (
          <div className="flex flex-col items-center gap-6">
            <div className="relative flex h-20 w-20 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground opacity-20" />
              <span className="relative inline-flex h-12 w-12 rounded-full bg-foreground opacity-80" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">Finding opponent…</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">This usually takes a few seconds</p>
            </div>
            <button
              onClick={handleCancel}
              className="h-10 px-6 rounded-full border border-black/[.08] dark:border-white/[.08] text-sm font-medium transition-colors hover:bg-black/[.04] dark:hover:bg-white/[.04]"
            >
              Cancel
            </button>
          </div>
        )}
      </main>

      <section className="px-4 pb-8 w-full max-w-sm mx-auto">
        <h2 className="mb-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          Recent matches
        </h2>
        <div className="rounded-2xl border border-black/[.08] dark:border-white/[.08] p-8 text-center">
          <p className="text-sm text-zinc-400 dark:text-zinc-600">No matches yet</p>
        </div>
      </section>
    </div>
  )
}
