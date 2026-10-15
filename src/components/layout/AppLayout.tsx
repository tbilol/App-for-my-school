import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { AppHeader } from './AppHeader'
import { BottomNav } from './BottomNav'

export function AppLayout() {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        {/* phone: top padding replaces the (desktop-only) header's safe-area inset; bottom clears the fixed nav */}
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-[calc(5rem+env(safe-area-inset-bottom))] md:px-8 md:pt-6 md:pb-10">
          <Suspense fallback={<div className="grid place-items-center py-24"><Loader2 className="size-6 animate-spin text-primary" /></div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
