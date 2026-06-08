'use client'

import { useEffect } from 'react'

export type ToastVariant = 'error' | 'success' | 'power_earned_me' | 'power_earned_opp' |
  'power_used_me' | 'power_used_opp' | 'badge' | 'danger_zone' | 'time_warn'

const TOAST_CONFIGS: Record<ToastVariant, { icon: string; title: string; sub?: string; bg: string; border: string; color: string; bar: string }> = {
  error:            { icon: '✕',  title: 'Invalid word',             sub: undefined,                   bg: '#fef2f2', border: '#fca5a5', color: '#dc2626', bar: '#dc2626' },
  success:          { icon: '✓',  title: 'Nice!',                    sub: undefined,                   bg: '#f0fdf4', border: '#86efac', color: '#16a34a', bar: '#16a34a' },
  power_earned_me:  { icon: '🎁', title: 'Power earned!',            sub: 'Use it from your tray',     bg: '#f0fdf4', border: '#86efac', color: '#16a34a', bar: '#16a34a' },
  power_earned_opp: { icon: '👀', title: 'Opponent earned a power',  sub: 'Watch out',                 bg: '#f8fafc', border: '#cbd5e1', color: '#475569', bar: '#94a3b8' },
  power_used_me:    { icon: '💣', title: 'Power activated!',         sub: undefined,                   bg: '#faf5ff', border: '#c4b5fd', color: '#7c3aed', bar: '#7c3aed' },
  power_used_opp:   { icon: '⚡', title: 'Opponent used a power!',   sub: undefined,                   bg: '#eff6ff', border: '#93c5fd', color: '#2563eb', bar: '#2563eb' },
  badge:            { icon: '🏅', title: 'Badge unlocked!',          sub: undefined,                   bg: '#fffbeb', border: '#fcd34d', color: '#d97706', bar: '#d97706' },
  danger_zone:      { icon: '⚡', title: 'Danger Zone!',             sub: '3× scoring · 5s turns now', bg: '#fff7ed', border: '#fb923c', color: '#ea580c', bar: '#ea580c' },
  time_warn:        { icon: '⏱', title: '3 seconds left!',          sub: undefined,                   bg: '#fef2f2', border: '#fca5a5', color: '#dc2626', bar: '#dc2626' },
}

interface GameToastProps {
  variant: ToastVariant
  subText?: string
  onDismiss?: () => void
}

export default function GameToast({ variant, subText, onDismiss }: GameToastProps) {
  const t = TOAST_CONFIGS[variant]

  useEffect(() => {
    if (!onDismiss) return
    const id = setTimeout(onDismiss, 2500)
    return () => clearTimeout(id)
  }, [onDismiss])

  const sub = subText ?? t.sub

  return (
    <>
      <style>{`@keyframes shrink-bar { from { width: 100%; } to { width: 0%; } }`}</style>
      <div style={{ margin: '8px 14px 0', borderRadius: 'var(--radius-lg)', background: t.bg, border: `1px solid ${t.border}`, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 10, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', position: 'relative', overflow: 'hidden' }}>
        <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{t.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-heading)', color: t.color, margin: 0, lineHeight: 1.3 }}>{t.title}</p>
          {sub && <p style={{ fontSize: 11, fontFamily: 'var(--font-body)', color: 'var(--n500)', margin: '2px 0 0', lineHeight: 1.3 }}>{sub}</p>}
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, height: 2, background: t.bar, borderRadius: '0 2px 0 0', opacity: 0.7, animation: 'shrink-bar 2500ms linear forwards' }} />
      </div>
    </>
  )
}
