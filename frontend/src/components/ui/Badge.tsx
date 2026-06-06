import React from 'react'

type BadgeVariant = 'neutral' | 'success' | 'danger' | 'warning' | 'info' | 'accent' | 'rare'
type BadgeSize = 'sm' | 'xs'

interface BadgeProps {
  variant?: BadgeVariant
  size?: BadgeSize
  children?: React.ReactNode
}

const variantStyles: Record<BadgeVariant, React.CSSProperties> = {
  neutral: { background: 'var(--n100)', color: 'var(--n500)' },
  success: { background: 'var(--success-light)', color: 'var(--success)' },
  danger: { background: 'var(--danger-light)', color: 'var(--danger)' },
  warning: { background: 'var(--warning-light)', color: 'var(--warning)' },
  info: { background: 'var(--info-light)', color: 'var(--info)' },
  accent: { background: 'var(--accent-warm-faint)', color: 'var(--accent-warm-muted)' },
  rare: { background: 'var(--rare-bg)', color: 'var(--rare)' },
}

const sizeStyles: Record<BadgeSize, React.CSSProperties> = {
  sm: { padding: '3px 10px', fontSize: '11px' },
  xs: { padding: '2px 6px', fontSize: '9px' },
}

export default function Badge({
  variant = 'neutral',
  size = 'sm',
  children,
}: BadgeProps) {
  const style: React.CSSProperties = {
    ...variantStyles[variant],
    ...sizeStyles[size],
    borderRadius: 'var(--radius-full)',
    fontWeight: 500,
    fontFamily: 'var(--font-body)',
    display: 'inline-block',
    whiteSpace: 'nowrap',
    lineHeight: 1.4,
  }

  return (
    <span style={style}>
      {children}
    </span>
  )
}
