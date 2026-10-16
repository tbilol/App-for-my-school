import { useLocation } from 'react-router-dom'
import { sectionTitle } from './nav-items'

/**
 * Desktop-only sticky top bar: section title. The profile + balance live in the
 * sidebar card. Phones have no top bar — just content + the bottom nav.
 */
export function AppHeader() {
  const { pathname } = useLocation()
  return (
    <header className="sticky top-0 z-30 hidden border-b bg-background/90 backdrop-blur md:block">
      <div className="mx-auto flex h-16 max-w-5xl items-center px-8">
        <span className="truncate text-lg font-semibold" data-testid="header-title">{sectionTitle(pathname)}</span>
      </div>
    </header>
  )
}
