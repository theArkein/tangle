'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

interface NavItem {
  id: string
  icon: string
  label: string
  href: string
  disabled?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', icon: '🏠', label: 'Home', href: '/' },
  { id: 'profile', icon: '👤', label: 'Profile', href: '/profile' },
  { id: 'league', icon: '🏅', label: 'League', href: '/league', disabled: true },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: '100%',
        background: 'var(--n0)',
        borderTop: '1px solid var(--n200)',
        display: 'flex',
        justifyContent: 'space-around',
        padding: '6px 0 env(safe-area-inset-bottom, 8px)',
        zIndex: 200,
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href
        const color = isActive ? 'var(--n900)' : 'var(--n400)'

        if (item.disabled) {
          return (
            <button
              key={item.id}
              type="button"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                background: 'none',
                border: 'none',
                cursor: 'not-allowed',
                padding: '6px 20px',
                color,
                opacity: 0.35,
              }}
              disabled
            >
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  fontFamily: 'var(--font-body)',
                }}
              >
                {item.label}
              </span>
            </button>
          )
        }

        return (
          <Link
            key={item.id}
            href={item.href}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px 20px',
              color,
              textDecoration: 'none',
            }}
          >
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 500,
                fontFamily: 'var(--font-body)',
              }}
            >
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
