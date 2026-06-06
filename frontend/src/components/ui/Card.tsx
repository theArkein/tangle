'use client'

import React, { useState } from 'react'

interface CardProps {
  children?: React.ReactNode
  onClick?: React.MouseEventHandler<HTMLDivElement>
  style?: React.CSSProperties
  className?: string
}

export default function Card({
  children,
  onClick,
  style,
  className,
}: CardProps) {
  const [hovered, setHovered] = useState(false)

  const baseStyle: React.CSSProperties = {
    borderRadius: 'var(--radius-xl)',
    background: 'var(--n0)',
    overflow: 'hidden',
    cursor: onClick ? 'pointer' : 'default',
    transition: 'border-color 0.15s',
    ...style,
    border: `1px solid ${hovered && onClick ? 'var(--n300)' : 'var(--n200)'}`,
  }

  return (
    <div
      style={baseStyle}
      className={className}
      onClick={onClick}
      onMouseEnter={onClick ? () => setHovered(true) : undefined}
      onMouseLeave={onClick ? () => setHovered(false) : undefined}
    >
      {children}
    </div>
  )
}
