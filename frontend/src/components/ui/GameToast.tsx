'use client'

export const TOAST_DURATION = 2500

export type ToastVariant = 'error' | 'success' | 'badge' | 'danger_zone' | 'time_warn'

const TOAST_CONFIGS: Record<ToastVariant, { icon: string; title: string; sub?: string; bg: string }> = {
  error:       { icon: '✕',  title: 'Invalid word',  bg: '#991b1b' },
  success:     { icon: '✓',  title: 'Nice!',         bg: '#14532d' },
  badge:       { icon: '🏅', title: 'Badge unlocked!', bg: '#78350f' },
  danger_zone: { icon: '⚡', title: 'Danger Zone!',  sub: '3× scoring · 5s turns now', bg: '#7c2d12' },
  time_warn:   { icon: '⏱', title: '3 seconds left!', bg: '#991b1b' },
}

interface GameToastProps {
  variant: ToastVariant
  subText?: string
  onDismiss?: () => void
}

export default function GameToast({ variant, subText, onDismiss }: GameToastProps) {
  const t = TOAST_CONFIGS[variant]
  const sub = subText ?? t.sub

  return (
    <div style={{ borderRadius: 'var(--radius-md)', background: t.bg, color: 'var(--n0)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', maxWidth: 300, width: '100%' }}>
      <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{t.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-heading)', lineHeight: 1.2 }}>{t.title}</div>
        {sub && <div style={{ fontSize: 11, opacity: 0.75, marginTop: 3, lineHeight: 1.3, fontFamily: 'var(--font-body)' }}>{sub}</div>}
      </div>
      <button
        onClick={onDismiss}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontSize: 13, lineHeight: 1, color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}
        aria-label="Dismiss"
      >✕</button>
    </div>
  )
}
