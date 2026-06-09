'use client'

import { useState } from 'react'
import { useSoundEngine } from '@/hooks/useSoundEngine'

const ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['⌫','Z','X','C','V','B','N','M','↵'],
]

interface GameKeyboardProps {
  onKey: (key: string) => void
  disabled?: boolean
}

export default function GameKeyboard({ onKey, disabled }: GameKeyboardProps) {
  const [pressedKey, setPressedKey] = useState<string | null>(null)
  const { play } = useSoundEngine()

  const handlePointerDown = (k: string) => (e: React.PointerEvent) => {
    e.preventDefault()
    if (disabled) return
    setPressedKey(k)
    play('tap')
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(30)
    }
    if (k === '⌫') onKey('BACKSPACE')
    else if (k === '↵') onKey('ENTER')
    else onKey(k)
  }

  const handlePointerUp = () => setPressedKey(null)

  return (
    <div
      style={{
        background: '#d1d5db',
        borderTop: '1px solid #9ca3af',
        padding: '12px 6px',
        paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        flexShrink: 0,
      } as React.CSSProperties}
    >
      {ROWS.map((row, ri) => (
        <div key={ri} style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
          {row.map(k => {
            const isAction = k === '⌫' || k === '↵'
            const isReturn = k === '↵'
            const isPressed = pressedKey === k && !disabled

            return (
              <div
                key={k}
                onPointerDown={handlePointerDown(k)}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{
                  position: 'relative',
                  background: isPressed
                    ? (isAction ? '#8d9198' : '#c8c8c8')
                    : (isAction ? '#adb5bd' : '#fff'),
                  borderRadius: 6,
                  boxShadow: isPressed
                    ? 'inset 0 1px 2px rgba(0,0,0,0.25)'
                    : '0 2px 0 #868e96',
                  transform: isPressed ? 'translateY(1px)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: isAction ? 14 : 16,
                  fontFamily: 'var(--font-body)',
                  color: disabled ? '#9ca3af' : '#1c1917',
                  fontWeight: isReturn ? 700 : 500,
                  cursor: disabled ? 'default' : 'pointer',
                  minWidth: isAction ? 48 : 34,
                  height: 48,
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                  transition: 'background 60ms, box-shadow 60ms, transform 60ms',
                  overflow: 'visible',
                } as React.CSSProperties}
              >
                {k}
                {/* iOS-style popover bubble */}
                {isPressed && !isAction && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 6px)',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#fff',
                      borderRadius: 8,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.22)',
                      width: 44,
                      height: 52,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 26,
                      fontWeight: 500,
                      fontFamily: 'var(--font-body)',
                      color: '#1c1917',
                      pointerEvents: 'none',
                      zIndex: 100,
                    }}
                  >
                    {k}
                    {/* tail */}
                    <div style={{
                      position: 'absolute',
                      bottom: -6,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 0,
                      height: 0,
                      borderLeft: '7px solid transparent',
                      borderRight: '7px solid transparent',
                      borderTop: '7px solid #fff',
                      filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))',
                    }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
