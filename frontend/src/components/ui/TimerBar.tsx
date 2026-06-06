import React from 'react'

interface TimerBarProps {
  percent: number
  danger?: boolean
  label?: string
}

export default function TimerBar({
  percent,
  danger = false,
  label,
}: TimerBarProps) {
  const clampedPercent = Math.min(100, Math.max(0, percent))

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
  }

  const trackStyle: React.CSSProperties = {
    flex: 1,
    height: '5px',
    background: 'var(--n200)',
    borderRadius: 'var(--radius-full)',
    overflow: 'hidden',
  }

  const fillStyle: React.CSSProperties = {
    width: `${clampedPercent}%`,
    height: '100%',
    background: danger ? 'var(--danger)' : 'var(--n400)',
    borderRadius: 'var(--radius-full)',
    transition: 'width 0.3s',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 600,
    fontFamily: 'var(--font-mono)',
    color: danger ? 'var(--danger)' : 'var(--n600)',
    minWidth: '24px',
    textAlign: 'right',
  }

  return (
    <div style={containerStyle}>
      <div style={trackStyle}>
        <div style={fillStyle} />
      </div>
      {label !== undefined && (
        <span style={labelStyle}>{label}</span>
      )}
    </div>
  )
}
