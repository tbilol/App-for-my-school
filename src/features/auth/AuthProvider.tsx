import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Profile, UserRole } from '@/types/models'
import { loginEmail } from './authEmails'

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  /** True until the stored session (and its profile, if any) has been resolved. */
  loading: boolean
  profileError: boolean
  /** Every role signs in by login + password. Throws Error('invalid_credentials'). */
  signInLogin: (login: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  hasRole: (...roles: UserRole[]) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function signInWithEmail(email: string | null, password: string) {
  if (!email) throw new Error('invalid_credentials')
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(/invalid login credentials/i.test(error.message) ? 'invalid_credentials' : error.message)
}

export const profileKey = (userId: string | undefined) => ['profile', userId] as const

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const userId = session?.user.id

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      // Don't leak one user's cached data into the next session.
      if (event === 'SIGNED_OUT') queryClient.clear()
    })
    return () => sub.subscription.unsubscribe()
  }, [queryClient])

  const profileQuery = useQuery({
    queryKey: profileKey(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId!).single()
      if (error) throw error
      return data as Profile
    },
  })

  // Live balance: the ledger trigger updates profiles.coin_balance; push it straight into the cache.
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`profile:${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        (payload) => {
          queryClient.setQueryData(profileKey(userId), payload.new as Profile)
          queryClient.invalidateQueries({ queryKey: ['transactions'] })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, queryClient])

  const value = useMemo<AuthContextValue>(() => {
    const profile = profileQuery.data ?? null
    return {
      session,
      profile,
      loading: sessionLoading || (!!userId && profileQuery.isPending),
      profileError: !!userId && profileQuery.isError,
      signInLogin: (login, password) => signInWithEmail(loginEmail(login), password),
      signOut: async () => {
        await supabase.auth.signOut()
      },
      hasRole: (...roles) => !!profile && roles.includes(profile.role),
    }
  }, [session, sessionLoading, userId, profileQuery.data, profileQuery.isPending, profileQuery.isError])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
