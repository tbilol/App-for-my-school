import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { CoinAmount } from '@/components/CoinAmount'
import { useAuth } from '@/features/auth/AuthProvider'
import { UserMenu } from './UserMenu'
import { useT } from '@/i18n'

/** Phone top bar: logo, live coin balance (students), user menu with panel links. */
export function MobileHeader() {
  const t = useT()
  const { profile } = useAuth()
  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
      <div className="flex h-14 items-center justify-between gap-2 px-4">
        <Link to="/" aria-label={t.nav.home}><Logo /></Link>
        <div className="flex items-center gap-2">
          {profile?.role === 'student' && (
            <Link to="/profile" className="rounded-full bg-primary-soft px-3 py-1.5 text-sm text-primary">
              <CoinAmount value={profile.coin_balance} />
            </Link>
          )}
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
