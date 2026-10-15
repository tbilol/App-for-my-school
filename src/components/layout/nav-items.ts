import { House, ListChecks, ShoppingBag, Trophy, User, GraduationCap, ShieldCheck, type LucideIcon } from 'lucide-react'
import { t } from '@/i18n'
import type { UserRole } from '@/types/models'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Roles that may see the item; omitted = everyone. */
  roles?: UserRole[]
}

/** The 5 primary destinations — bottom bar on phones, sidebar on desktop. */
export const primaryNav: NavItem[] = [
  { to: '/', label: t.nav.home, icon: House },
  { to: '/challenges', label: t.nav.challenges, icon: ListChecks },
  { to: '/shop', label: t.nav.shop, icon: ShoppingBag },
  { to: '/ratings', label: t.nav.ratings, icon: Trophy },
  { to: '/profile', label: t.nav.profile, icon: User },
]

/** Role-gated panels — never in the student bottom bar. */
export const panelNav: NavItem[] = [
  { to: '/teacher', label: t.nav.teacher, icon: GraduationCap, roles: ['teacher', 'admin'] },
  { to: '/admin', label: t.nav.admin, icon: ShieldCheck, roles: ['admin'] },
]
