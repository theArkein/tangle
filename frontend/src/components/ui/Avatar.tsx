import React from 'react'

type AvatarVariant = 'p1' | 'p2' | 'neutral'

interface AvatarProps {
  name: string
  variant?: AvatarVariant
  size?: number
}

const variantStyles: Record<AvatarVariant, React.CSSProperties> = {
  p1: { background: 'var(--p1-light)', color: 'var(--p1)' },
  p2: { background: 'var(--p2-light)', color: 'var(--p2)' },
  neutral: { background: 'var(--n100)', color: 'var(--n500)' },
}

export default function Avatar({
  name,
  variant = 'neutral',
  size = 36,
}: AvatarProps) {
  const letter = name === '?' ? '?' : (name[0] ?? '?').toUpperCase()

  const style: React.CSSProperties = {
    ...variantStyles[variant],
    width: size,
    height: size,
    borderRadius: 'var(--radius-full)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: size * 0.36,
    fontWeight: 600,
    fontFamily: 'var(--font-heading)',
    flexShrink: 0,
    userSelect: 'none',
  }

  return (
    <div style={style} aria-label={name}>
      {letter}
    </div>
  )
}
