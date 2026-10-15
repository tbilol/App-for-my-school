import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { FullPageSpinner } from '@/components/FullPageSpinner'
import { ProfileErrorScreen } from './ProfileErrorScreen'
import type { UserRole } from '@/types/models'

/** Signed-in users only; others go to /login and come back afterwards. */
export function RequireAuth() {
  const { session, loading, profile, profileError } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageSpinner />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (profileError || !profile) return <ProfileErrorScreen />
  return <Outlet />
}

/** Role gate for panels. UI hiding is convenience — the database RLS is the real guard. */
export function RequireRole({ roles }: { roles: UserRole[] }) {
  const { hasRole } = useAuth()
  return hasRole(...roles) ? <Outlet /> : <Navigate to="/" replace />
}

export function RedirectIfAuthed() {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullPageSpinner />
  if (session) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from && from !== '/login' ? from : '/'} replace />
  }
  return <Outlet />
}
