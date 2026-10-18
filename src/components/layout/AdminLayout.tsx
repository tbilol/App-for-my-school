import { Suspense, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Loader2, LogOut, Menu } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useAuth } from '@/features/auth/AuthProvider'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { adminNav } from './nav-items'

/**
 * The admin app: a separate shell from the student app (dark sidebar, its own
 * routes, no coin balance, no bottom bar). Reached by admin and super_admin.
 */
function AdminNavList({ onNavigate }: { onNavigate?: () => void }) {
  const t = useT()
  const { hasRole } = useAuth()
  return (
    <nav className="flex flex-col gap-0.5 px-3" aria-label={t.nav.admin}>
      {adminNav.filter((i) => !i.roles || hasRole(...i.roles)).map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white',
            )
          }
        >
          <Icon className="size-4.5" /> {label}
        </NavLink>
      ))}
    </nav>
  )
}

function AdminBrand() {
  const t = useT()
  return (
    <div className="flex items-center gap-2.5 px-5 py-5">
      <img src="/logo-crest-384.png" alt="" className="size-9 rounded-full bg-white" />
      <div className="leading-tight">
        <div className="text-sm font-bold text-white">{t.app.name}</div>
        <div className="text-xs text-slate-400">{t.nav.admin}</div>
      </div>
    </div>
  )
}

function SignOutButton() {
  const t = useT()
  const { profile, signOut } = useAuth()
  return (
    <div className="m-3 flex items-center gap-2 rounded-lg bg-white/5 p-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-white">{profile?.full_name}</div>
        <div className="text-xs text-slate-400">{profile && t.roles[profile.role]}</div>
      </div>
      <button onClick={() => void signOut()} className="rounded-md p-2 text-slate-400 hover:bg-white/10 hover:text-white" aria-label={t.auth.signOut} title={t.auth.signOut}>
        <LogOut className="size-4" />
      </button>
    </div>
  )
}

export function AdminLayout() {
  const t = useT()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="flex min-h-dvh bg-muted">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-slate-900 lg:flex">
        <AdminBrand />
        <div className="flex-1 overflow-y-auto"><AdminNavList /></div>
        <SignOutButton />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-slate-900 px-4 pt-[env(safe-area-inset-top)] text-white lg:hidden">
          <button onClick={() => setMenuOpen(true)} className="-ml-1 rounded-md p-2 hover:bg-white/10" aria-label={t.common.menu}>
            <Menu className="size-5" />
          </button>
          <span className="font-semibold">{t.nav.admin}</span>
        </header>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="left" className="w-64 border-0 bg-slate-900 p-0 text-white">
            <SheetTitle className="sr-only">{t.nav.admin}</SheetTitle>
            <AdminBrand />
            <div className="flex-1 overflow-y-auto"><AdminNavList onNavigate={() => setMenuOpen(false)} /></div>
            <SignOutButton />
          </SheetContent>
        </Sheet>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:px-8 md:py-8">
          <Suspense fallback={<div className="grid place-items-center py-24"><Loader2 className="size-6 animate-spin text-primary" /></div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
