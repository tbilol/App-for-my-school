import { Suspense, useState } from 'react'
import { Link, Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { CalendarCheck, Coins, House, Loader2, LogOut, MessagesSquare, Trophy, type LucideIcon } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Skeleton } from '@/components/ui/skeleton'
import { UserAvatar } from '@/components/UserAvatar'
import { useAuth } from '@/features/auth/AuthProvider'
import { useMyChildren, type Child } from '@/features/parent/api'
import { unreadTotal, useConversations } from '@/features/messages/api'
import { UnreadBadge } from '@/features/messages/components'
import { cn } from '@/lib/utils'
import { t as dict, useT } from '@/i18n'

const NAV: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/parent', label: dict.parent.navOverview, icon: House },
  { to: '/parent/coins', label: dict.parent.navCoins, icon: Coins },
  { to: '/parent/daily', label: dict.parent.navDaily, icon: CalendarCheck },
  { to: '/parent/rating', label: dict.parent.navRating, icon: Trophy },
  { to: '/parent/messages', label: dict.parent.navMessages, icon: MessagesSquare },
]

const STORE_KEY = 'zamin.parent.child'

/** The selected child, for the parent pages under this layout. */
export function useSelectedChild() {
  return useOutletContext<{ child: Child }>().child
}

function readStored() {
  try { return sessionStorage.getItem(STORE_KEY) } catch { return null }
}

/** Read-only parent app: header, child switcher, section nav (bottom bar on phones, tabs on desktop). */
export function ParentLayout() {
  const t = useT()
  const { pathname } = useLocation()
  const { profile, signOut } = useAuth()
  const children = useMyChildren()
  const [selected, setSelected] = useState<string | null>(readStored)
  const child = children.data?.find((c) => c.id === selected) ?? children.data?.[0]
  const conversations = useConversations()
  // badge on Xabarlar = the selected child's unread; the switcher marks other children with unread
  const badgeOf = (to: string) => (to === '/parent/messages' && child ? unreadTotal(conversations.data, child.id) : 0)

  const select = (id: string) => {
    setSelected(id)
    try { sessionStorage.setItem(STORE_KEY, id) } catch { /* per-tab convenience only */ }
  }
  const isActive = (to: string) => (to === '/parent' ? pathname === '/parent' || pathname === '/parent/' : pathname.startsWith(to))
  const hasNav = !!child

  return (
    <div className="min-h-dvh bg-muted">
      <header className="sticky top-0 z-30 border-b bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-2 px-4">
          <Logo />
          <div className="flex min-w-0 items-center gap-1">
            <span className="hidden truncate text-sm text-muted-foreground sm:inline">{profile?.full_name}</span>
            <button onClick={() => void signOut()} className="flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground">
              <LogOut className="size-4" /> <span className="max-sm:sr-only">{t.auth.signOut}</span>
            </button>
          </div>
        </div>
        {hasNav && (
          <nav className="mx-auto hidden max-w-2xl gap-1 px-4 md:flex" aria-label={t.parent.nav}>
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} aria-current={isActive(to) ? 'page' : undefined}
                className={cn('flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive(to) ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                <Icon className="size-4" /> {label}<UnreadBadge n={badgeOf(to)} />
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main className={cn('mx-auto w-full max-w-2xl px-4 py-5', hasNav ? 'pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-10' : 'pb-[calc(1.5rem+env(safe-area-inset-bottom))]')}>
        {children.isPending ? <Skeleton className="h-64 w-full rounded-2xl" /> : children.isError ? (
          <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{children.error.message}</p>
        ) : !child ? (
          <p className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">{t.parent.noChildren}</p>
        ) : (
          <>
            {children.data!.length > 1 && (
              <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label={t.parent.chooseChild} data-testid="child-switcher">
                {children.data!.map((c) => (
                  <button
                    key={c.id} role="tab" aria-selected={c.id === child.id} onClick={() => select(c.id)}
                    className={cn('flex shrink-0 items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm font-medium transition-colors',
                      c.id === child.id ? 'border-primary bg-primary-soft text-primary' : 'bg-card hover:bg-secondary')}
                  >
                    <UserAvatar name={c.full_name} url={c.avatar_url} className="size-7" /> {c.full_name.split(' ')[0]}
                    {c.id !== child.id && <UnreadBadge n={unreadTotal(conversations.data, c.id)} className="h-4 min-w-4 px-1 text-[10px]" />}
                  </button>
                ))}
              </div>
            )}
            <Suspense fallback={<div className="grid place-items-center py-24"><Loader2 className="size-6 animate-spin text-primary" /></div>}>
              <Outlet context={{ child }} />
            </Suspense>
          </>
        )}
      </main>

      {hasNav && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label={t.parent.nav}>
          <ul className="grid grid-cols-5">
            {NAV.map(({ to, label, icon: Icon }) => {
              const active = isActive(to)
              return (
                <li key={to}>
                  <Link to={to} aria-current={active ? 'page' : undefined}
                    className={cn('flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                      active ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>
                    <span className={cn('relative grid h-7 w-12 place-items-center rounded-full transition-colors', active && 'bg-primary-soft')}>
                      <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
                      <UnreadBadge n={badgeOf(to)} className="absolute -top-1 right-0.5 h-4 min-w-4 px-1 text-[10px]" />
                    </span>
                    <span className="max-w-full truncate px-0.5">{label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      )}
    </div>
  )
}
