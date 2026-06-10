'use client'

export const TOAST_DURATION = 2500

export type ToastVariant = 'error' | 'success' | 'badge' | 'danger_zone' | 'time_warn'

const TOAST_CONFIGS: Record<ToastVariant, { icon: string; title: string; sub?: string; bg: string }> = {
  error:       { icon: '✕',  title: 'Invalid word',  bg: '#991b1b' },
  success:     { icon: '✓',  title: 'Nice!',         bg: '#14532d' },
  badge:       { icon: '🏅', title: 'Badge unlocked!', bg: '#78350f' },
  danger_zone: { icon: '⚡', title: 'Danger Zone!',  sub: '3× scoring · 10s turns now', bg: '#7c2d12' },
  time_warn:   { icon: '⏱', title: '5 seconds left!', bg: '#991b1b' },
}

interface GameToastProps {
  variant: ToastVariant
  subText?: string
  title?: string
  onDismiss?: () => void
}

export default function GameToast({ variant, subText, title, onDismiss }: GameToastProps) {
  const t = TOAST_CONFIGS[variant]
  const displayTitle = title ?? t.title
  const sub = subText ?? t.sub

  return (
    <div style={{ borderRadius: 'var(--radius-md)', background: t.bg, color: 'var(--n0)', padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 3px 12px rgba(0,0,0,0.18)', maxWidth: 260, width: '100%' }}>
      <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{t.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-heading)', lineHeight: 1.2 }}>{displayTitle}</div>
        {sub && <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2, lineHeight: 1.3, fontFamily: 'var(--font-body)' }}>{sub}</div>}
      </div>
      <button
        onClick={onDismiss}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: 11, lineHeight: 1, color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}
        aria-label="Dismiss"
      >✕</button>
    </div>
  )
}
