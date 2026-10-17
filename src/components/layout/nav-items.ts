import {
  Award, CalendarCheck, CalendarDays, Library, Coins, GraduationCap, HeartHandshake, House, Megaphone, Package, Presentation, School,
  Settings, ShieldCheck, ShoppingBag, Trophy, User, Users, type LucideIcon,
} from 'lucide-react'
import { t } from '@/i18n'
import type { UserRole } from '@/types/models'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Roles that may see the item; omitted = everyone. */
  roles?: UserRole[]
  /**
   * Other routes that belong to this section and keep its tab highlighted:
   * Events + Announcements live under Home, Achievements under Profile.
   */
  owns?: string[]
}

/** The student-app sections — same set in the phone bottom bar and the desktop sidebar (items with `roles` are filtered). */
export const primaryNav: NavItem[] = [
  { to: '/', label: t.nav.home, icon: House, owns: ['/events', '/announcements'] },
  // Daily tasks took over the "Vazifalar" tab; the old challenges page is unrouted (/challenges → /daily).
  { to: '/daily', label: t.nav.challenges, icon: CalendarCheck, roles: ['student'] },
  { to: '/shop', label: t.nav.shop, icon: ShoppingBag },
  { to: '/ratings', label: t.nav.ratings, icon: Trophy },
  { to: '/profile', label: t.nav.profile, icon: User, owns: ['/achievements'] },
]

/** Is `item` the active section for `pathname`? */
export function isSectionActive(item: NavItem, pathname: string) {
  const match = (p: string) => (p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(p + '/'))
  return match(item.to) || (item.owns ?? []).some(match)
}

/** Title for the header: the section, or a known sub-page within it. */
export function sectionTitle(pathname: string) {
  const sub: Record<string, string> = { '/events': t.nav.events, '/announcements': t.nav.announcements, '/teacher': t.nav.teacher }
  const hit = Object.keys(sub).find((p) => pathname === p || pathname.startsWith(p + '/'))
  return hit ? sub[hit] : primaryNav.find((i) => isSectionActive(i, pathname))?.label ?? ''
}

/** Role-gated panels — never in the student bottom bar. (Admin has its own app at /admin.) */
export const panelNav: NavItem[] = [
  { to: '/teacher', label: t.nav.teacher, icon: GraduationCap, roles: ['teacher'] },
]

/** Admin app navigation (separate shell). Items with `roles` are filtered by the signed-in role. */
export const adminNav: NavItem[] = [
  { to: '/admin/classes', label: t.nav.classes, icon: School },
  { to: '/admin/teachers', label: t.nav.teachers, icon: Presentation },
  { to: '/admin/students', label: t.nav.students, icon: Users },
  { to: '/admin/parents', label: t.nav.parents, icon: HeartHandshake },
  { to: '/admin/bank', label: t.nav.bank, icon: Library },
  { to: '/admin/shop', label: t.nav.shop, icon: ShoppingBag },
  { to: '/admin/orders', label: t.nav.orders, icon: Package },
  { to: '/admin/achievements', label: t.nav.achievements, icon: Award },
  { to: '/admin/events', label: t.nav.events, icon: CalendarDays },
  { to: '/admin/announcements', label: t.nav.announcements, icon: Megaphone },
  { to: '/admin/economy', label: t.nav.economy, icon: Coins },
  { to: '/admin/settings', label: t.nav.settings, icon: Settings },
  { to: '/admin/admins', label: t.nav.admins, icon: ShieldCheck, roles: ['super_admin'] },
]
