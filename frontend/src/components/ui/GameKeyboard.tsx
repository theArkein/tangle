'use client'

import { useState } from 'react'

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

  const handlePointerDown = (k: string) => (e: React.PointerEvent) => {
    e.preventDefault()
    if (disabled) return
    setPressedKey(k)
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
        flexShrink: 0,
      }}
    >
      {ROWS.map((row, ri) => (
        <div key={ri} style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
          {row.map(k => {
            const isAction = k === '⌫' || k === '↵'
            const isReturn = k === '↵'
            const isPressed = pressedKey === k

            return (
              <div
                key={k}
                onPointerDown={handlePointerDown(k)}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{
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
                } as React.CSSProperties}
              >
                {k}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
