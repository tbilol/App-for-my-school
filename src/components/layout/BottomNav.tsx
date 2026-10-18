import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'
import { isSectionActive, primaryNav } from './nav-items'

/** Phone bottom bar: the student sections (role-filtered). */
export function BottomNav() {
  const t = useT()
  const { pathname } = useLocation()
  const { hasRole } = useAuth()
  const items = primaryNav.filter((i) => !i.roles || hasRole(...i.roles))

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      aria-label={t.nav.bottomNav}
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const active = isSectionActive(item, pathname)
          const Icon = item.icon
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={cn('flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
              >
                <span className={cn('grid h-7 w-12 place-items-center rounded-full transition-colors', active && 'bg-primary-soft')}>
                  <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
                </span>
                <span className="max-w-full truncate px-0.5">{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
