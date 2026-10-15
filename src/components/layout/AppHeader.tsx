import { Link, useLocation } from 'react-router-dom'
import { CoinAmount } from '@/components/CoinAmount'
import { useAuth } from '@/features/auth/AuthProvider'
import { UserMenu } from './UserMenu'
import { sectionTitle } from './nav-items'

/**
 * Desktop-only sticky top bar: section title, live balance, account menu.
 * Phones have no top bar — just content + the bottom nav. The balance lives on
 * Home (and Shop/Profile), and sign-out is in Profil → Sozlamalar.
 */
export function AppHeader() {
  const { profile } = useAuth()
  const { pathname } = useLocation()
  return (
    <header className="sticky top-0 z-30 hidden border-b bg-background/90 backdrop-blur md:block">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-2 px-8">
        <span className="truncate text-lg font-semibold" data-testid="header-title">{sectionTitle(pathname)}</span>
        <div className="flex items-center gap-2">
          {profile?.role === 'student' && (
            <Link to="/profile" className="rounded-full bg-primary-soft px-3 py-1.5 text-sm text-primary" data-testid="header-balance">
              <CoinAmount value={profile.coin_balance} />
            </Link>
          )}
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
