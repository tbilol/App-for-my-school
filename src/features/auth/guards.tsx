import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { FullPageSpinner } from '@/components/FullPageSpinner'
import { ProfileErrorScreen } from './ProfileErrorScreen'
import { roleHome } from './roleHome'
import type { UserRole } from '@/types/models'

/** Signed-in users only; others go to the role picker and come back afterwards. */
export function RequireAuth() {
  const { session, loading, profile, profileError } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageSpinner />
  if (!session) return <Navigate to="/welcome" replace state={{ from: location.pathname }} />
  if (profileError || !profile) return <ProfileErrorScreen />
  return <Outlet />
}

/** Role gate. Wrong role → that role's own home. UI gating is convenience; RLS is the real guard. */
export function RequireRole({ roles }: { roles: UserRole[] }) {
  const { profile, hasRole } = useAuth()
  return hasRole(...roles) ? <Outlet /> : <Navigate to={roleHome(profile?.role)} replace />
}

/** Onboarding screens: a signed-in user is sent to their home (or the page they wanted). */
export function RedirectIfAuthed() {
  const { session, loading, profile } = useAuth()
  const location = useLocation()
  if (loading) return <FullPageSpinner />
  if (session && profile) {
    const from = (location.state as { from?: string } | null)?.from
    const home = roleHome(profile.role)
    // only honour `from` inside the user's own app
    return <Navigate to={from && from !== '/' && from.startsWith(home) ? from : home} replace />
  }
  return <Outlet />
}
