'use client'

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
  return (
    <div style={{ background: '#d1d5db', borderTop: '1px solid #9ca3af', padding: '10px 6px env(safe-area-inset-bottom, 16px)', display: 'flex', flexDirection: 'column', gap: 8, userSelect: 'none', flexShrink: 0 }}>
      {ROWS.map((row, ri) => (
        <div key={ri} style={{ display: 'flex', justifyContent: 'center', gap: 5 }}>
          {row.map(k => {
            const isAction = k === '⌫' || k === '↵'
            const isReturn = k === '↵'
            return (
              <div
                key={k}
                onPointerDown={e => {
                  e.preventDefault()
                  if (disabled) return
                  if (k === '⌫') onKey('BACKSPACE')
                  else if (k === '↵') onKey('ENTER')
                  else onKey(k)
                }}
                style={{
                  background: isAction ? '#adb5bd' : '#fff',
                  borderRadius: 5,
                  boxShadow: '0 1px 0 #868e96',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: isAction ? 13 : 14,
                  fontFamily: 'var(--font-body)',
                  color: disabled ? '#9ca3af' : '#1c1917',
                  fontWeight: isReturn ? 600 : 400,
                  cursor: disabled ? 'default' : 'pointer',
                  minWidth: isAction ? 44 : 30,
                  height: 42,
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
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
