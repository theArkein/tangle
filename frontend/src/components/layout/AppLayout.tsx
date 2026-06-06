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
  player: PlayerInfo | null
}

function getWidth(): number {
  return typeof window !== 'undefined' ? window.innerWidth : 1200
}

export default function AppLayout({ children, player }: AppLayoutProps) {
  const pathname = usePathname()
  const [windowWidth, setWindowWidth] = useState<number>(getWidth)

  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Game routes opt out of navigation shell
  if (pathname.startsWith('/game')) {
    return <>{children}</>
  }

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
