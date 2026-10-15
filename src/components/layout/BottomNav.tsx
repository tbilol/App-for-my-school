import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'
import { primaryNav } from './nav-items'

/** Phone bottom bar with the 5 primary destinations. */
export function BottomNav() {
  const t = useT()
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      aria-label={t.nav.bottomNav}
    >
      <ul className="grid grid-cols-5">
        {primaryNav.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn('grid h-7 w-12 place-items-center rounded-full transition-colors', isActive && 'bg-primary-soft')}>
                    <Icon className="size-5" strokeWidth={isActive ? 2.4 : 2} />
                  </span>
                  <span className="max-w-full truncate px-0.5">{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
