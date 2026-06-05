'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'

function GameContent() {
  const params = useSearchParams()
  const router = useRouter()
  const roomId = params.get('room') ?? ''

  return (
    <div className="flex flex-col min-h-full items-center justify-center gap-4 px-4">
      <p className="text-lg font-semibold">Game screen coming soon</p>
      <p className="text-sm text-zinc-500 font-mono">{roomId}</p>
      <button
        onClick={() => router.push('/')}
        className="mt-4 h-10 px-6 rounded-full border border-black/[.08] dark:border-white/[.08] text-sm font-medium transition-colors hover:bg-black/[.04] dark:hover:bg-white/[.04]"
      >
        Back to lobby
      </button>
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
