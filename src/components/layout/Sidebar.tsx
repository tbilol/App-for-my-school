import { NavLink } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { CoinAmount } from '@/components/CoinAmount'
import { UserAvatar } from '@/components/UserAvatar'
import { useAuth } from '@/features/auth/AuthProvider'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { panelNav, primaryNav, type NavItem } from './nav-items'

function SideLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          isActive ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
        )
      }
    >
      <Icon className="size-5" />
      {item.label}
    </NavLink>
  )
}

/** Desktop (md+) navigation. */
export function Sidebar() {
  const t = useT()
  const { profile, hasRole, signOut } = useAuth()
  const panels = panelNav.filter((p) => !p.roles || hasRole(...p.roles))

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-card md:flex">
      <div className="px-5 py-5">
        <Logo />
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3" aria-label={t.nav.mainNav}>
        {primaryNav.map((item) => <SideLink key={item.to} item={item} />)}
        {panels.length > 0 && (
          <>
            <div className="mt-5 mb-1 px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t.common.panels}
            </div>
            {panels.map((item) => <SideLink key={item.to} item={item} />)}
          </>
        )}
      </nav>
      {profile && (
        <div className="m-3 flex items-center gap-3 rounded-xl border p-3">
          <UserAvatar name={profile.full_name} url={profile.avatar_url} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{profile.full_name}</div>
            {profile.role === 'student'
              ? <CoinAmount value={profile.coin_balance} className="text-xs" iconClassName="size-3.5" />
              : <div className="text-xs text-muted-foreground">{t.roles[profile.role]}</div>}
          </div>
          <button
            onClick={() => void signOut()}
            className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label={t.auth.signOut}
            title={t.auth.signOut}
          >
            <LogOut className="size-4" />
          </button>
        </div>
      )}
    </aside>
  )
}
