export interface NavItem {
  id: string
  icon: string
  label: string
  href: string
  disabled?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'home',    icon: '🏠', label: 'Home',    href: '/' },
  { id: 'profile', icon: '👤', label: 'Profile', href: '/profile' },
  { id: 'league',  icon: '🏅', label: 'League',  href: '/league', disabled: true },
]
