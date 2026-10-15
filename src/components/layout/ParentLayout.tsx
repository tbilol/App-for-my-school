import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { Loader2, LogOut } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { useAuth } from '@/features/auth/AuthProvider'
import { useT } from '@/i18n'

/** Read-only parent app: header + single column. No student navigation. */
export function ParentLayout() {
  const t = useT()
  const { profile, signOut } = useAuth()
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
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 py-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <Suspense fallback={<div className="grid place-items-center py-24"><Loader2 className="size-6 animate-spin text-primary" /></div>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
