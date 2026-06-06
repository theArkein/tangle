'use client'

import { useState, useEffect, ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'

export interface PlayerInfo {
  display_name: string
  elo: number
}

interface AppLayoutProps {
  children: ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname()
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined)
  const [player, setPlayer] = useState<PlayerInfo | null>(null)

  useEffect(() => {
    setWindowWidth(window.innerWidth)
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    fetch('/api/me')
      .then(r => {
        if (!r.ok) return null
        return r.json() as Promise<PlayerInfo>
      })
      .then(data => { if (data) setPlayer(data) })
      .catch(() => {})
  }, [])

  // Game routes opt out of navigation shell
  if (pathname.startsWith('/game')) {
    return <>{children}</>
  }

  if (windowWidth === undefined) return <>{children}</>

  const isMobile = windowWidth < 640
  const isTablet = windowWidth >= 640 && windowWidth < 900
  const isDesktop = windowWidth >= 900

  const eloText = player ? `Word Slinger · ELO ${player.elo}` : null

  const contentMarginLeft = isMobile ? 0 : isTablet ? 64 : 220
  const contentPaddingBottom = isMobile ? '60px' : undefined

  return (
    <>
      {isMobile && <BottomNav />}
      {(isTablet || isDesktop) && (
        <Sidebar collapsed={isTablet} eloText={eloText} />
      )}
      <main
        style={{
          marginLeft: contentMarginLeft,
          paddingBottom: contentPaddingBottom,
          minHeight: '100vh',
        }}
      >
        {children}
      </main>
    </>
  )
}
