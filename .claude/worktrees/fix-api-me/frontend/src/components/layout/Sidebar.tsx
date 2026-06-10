'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { NAV_ITEMS, NavItem } from './navItems'

interface SidebarProps {
  collapsed: boolean
  eloText: string | null
}

export default function Sidebar({ collapsed, eloText }: SidebarProps) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Main navigation"
      style={{
        width: collapsed ? 64 : 220,
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        background: 'var(--n0)',
        borderRight: '1px solid var(--n200)',
        display: 'flex',
        flexDirection: 'column',
        padding: collapsed ? '20px 8px' : '24px 14px',
        transition: 'width 0.2s',
        zIndex: 200,
        overflowX: 'hidden',
      }}
    >
      {/* Logo section */}
      <div
        style={{
          borderBottom: '1px solid var(--n100)',
          marginBottom: 16,
          paddingBottom: 16,
        }}
      >
        {collapsed ? (
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 20,
              color: 'var(--n900)',
              display: 'block',
              textAlign: 'center',
            }}
          >
            CB
          </span>
        ) : (
          <div>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 20,
                color: 'var(--n900)',
                display: 'block',
              }}
            >
              Chain Battle
            </span>
            {eloText && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--n400)',
                  display: 'block',
                  marginTop: 2,
                }}
              >
                {eloText}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Nav items */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          flex: 1,
        }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href

          if (item.disabled) {
            return (
              <button
                key={item.id}
                type="button"
                disabled
                title={collapsed ? item.label : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: collapsed ? '10px' : '10px 12px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'not-allowed',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--n900)',
                  opacity: 0.35,
                  width: '100%',
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                }}
              >
                <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </button>
            )
          }

          return (
            <NavLink
              key={item.id}
              item={item}
              isActive={isActive}
              collapsed={collapsed}
            />
          )
        })}
      </div>

      {/* Play button */}
      <div
        style={{
          borderTop: '1px solid var(--n100)',
          paddingTop: 16,
          marginTop: 8,
        }}
      >
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 8,
            padding: collapsed ? '10px' : '10px 14px',
            background: 'var(--n900)',
            color: 'var(--n0)',
            borderRadius: 'var(--radius-md)',
            textDecoration: 'none',
            fontFamily: 'var(--font-heading)',
            fontWeight: 500,
            fontSize: 13,
            width: '100%',
            boxSizing: 'border-box',
            transition: 'opacity 0.15s',
          }}
        >
          <span>▶</span>
          {!collapsed && <span>Play now</span>}
        </Link>
      </div>
    </nav>
  )
}

interface NavLinkProps {
  item: NavItem
  isActive: boolean
  collapsed: boolean
}

function NavLink({ item, isActive, collapsed }: NavLinkProps) {
  const [hovered, setHovered] = useState(false)

  const bg = isActive
    ? 'var(--n100)'
    : hovered
    ? 'var(--n50)'
    : 'transparent'

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: collapsed ? '10px' : '10px 12px',
        background: bg,
        borderRadius: 'var(--radius-md)',
        color: 'var(--n900)',
        textDecoration: 'none',
        fontFamily: 'var(--font-body)',
        fontSize: 14,
        transition: 'background 0.15s',
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
      {!collapsed && <span>{item.label}</span>}
    </Link>
  )
}
