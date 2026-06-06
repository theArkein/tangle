import React from 'react'

type WordPillVariant = 'player1' | 'player2' | 'danger' | 'mystery' | 'neutral'
type WordPillSize = 'sm' | 'md'

interface WordPillProps {
  word: string
  variant?: WordPillVariant
  size?: WordPillSize
}

const variantStyles: Record<WordPillVariant, React.CSSProperties> = {
  player1: { background: 'var(--p1-light)', color: 'var(--p1)' },
  player2: { background: 'var(--p2-light)', color: 'var(--p2)' },
  danger: { background: 'var(--danger-light)', color: 'var(--danger)' },
  mystery: { background: 'var(--mystery-bg)', color: 'var(--mystery)' },
  neutral: { background: 'var(--n100)', color: 'var(--n600)' },
}

const sizeStyles: Record<WordPillSize, React.CSSProperties> = {
  sm: { padding: '4px 10px', fontSize: '12px' },
  md: { padding: '6px 14px', fontSize: '14px' },
}

export default function WordPill({
  word,
  variant = 'neutral',
  size = 'md',
}: WordPillProps) {
  const style: React.CSSProperties = {
    ...variantStyles[variant],
    ...sizeStyles[size],
    borderRadius: 'var(--radius-full)',
    fontWeight: 500,
    fontFamily: 'var(--font-body)',
    display: 'inline-block',
    whiteSpace: 'nowrap' as const,
  }

  return (
    <span style={style}>
      {word}
    </span>
  )
}
