import React from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl'

interface ButtonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  full?: boolean
  icon?: React.ReactNode
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  children?: React.ReactNode
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'var(--n900)',
    color: 'var(--n0)',
    border: 'none',
  },
  secondary: {
    background: 'var(--n0)',
    color: 'var(--n700)',
    border: '1px solid var(--n200)',
  },
  accent: {
    background: 'var(--accent-warm)',
    color: 'var(--n0)',
    border: 'none',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--n600)',
    border: 'none',
  },
  danger: {
    background: 'var(--danger-light)',
    color: 'var(--danger)',
    border: 'none',
  },
}

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: '7px 14px', fontSize: '12px' },
  md: { padding: '11px 22px', fontSize: '13px' },
  lg: { padding: '14px 28px', fontSize: '15px' },
  xl: { padding: '16px 32px', fontSize: '16px' },
}

export default function Button({
  variant = 'primary',
  size = 'md',
  full = false,
  icon,
  onClick,
  children,
  className,
  disabled = false,
  type = 'button',
}: ButtonProps) {
  const style: React.CSSProperties = {
    ...variantStyles[variant],
    ...sizeStyles[size],
    borderRadius: 'var(--radius-md)',
    fontFamily: 'var(--font-heading)',
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    width: full ? '100%' : undefined,
    transition: 'all 0.15s',
    textDecoration: 'none',
    lineHeight: 1,
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={style}
    >
      {icon}
      {children}
    </button>
  )
}
