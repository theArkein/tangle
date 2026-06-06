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
    border: `1px solid ${hovered && onClick ? 'var(--n300)' : 'var(--n200)'}`,
    borderRadius: 'var(--radius-xl)',
    background: 'var(--n0)',
    overflow: 'hidden',
    transition: 'border-color 0.15s',
    cursor: onClick ? 'pointer' : undefined,
    ...style,
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
