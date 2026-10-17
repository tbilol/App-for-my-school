import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import { fetchSetsWithProgress } from '@/features/daily/api'
import { schoolToday } from '@/features/school/api'
import type { CoinTransaction, LeaderboardRow, Profile, StudentLevel, StudentStreak, Subject } from '@/types/models'

// Parent portal reads. Everything goes through RLS: a parent can only ever load
// rows of their linked children (private.is_parent_of), and nothing here writes.

async function rows<T>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p
  if (error) throw new Error(error.message)
  return data as T
}

export type Child = Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'coin_balance' | 'class_id'>

export const parentKeys = {
  children: (parentId: string | undefined) => ['parent', 'children', parentId] as const,
  tx: (childId: string) => ['parent', 'tx', childId] as const,
  totals: (childId: string) => ['parent', 'totals', childId] as const,
  sets: (childId: string) => ['parent', 'sets', childId] as const,
  streaks: (childId: string) => ['parent', 'streaks', childId] as const,
  levels: (childId: string) => ['parent', 'levels', childId] as const,
  rank: (childId: string) => ['parent', 'rank', childId] as const,
  subjectRanks: (childId: string) => ['parent', 'subject-ranks', childId] as const,
}

/** The signed-in parent's linked children, by name. */
export function useMyChildren() {
  const { profile } = useAuth()
  return useQuery({
    queryKey: parentKeys.children(profile?.id),
    enabled: !!profile,
    queryFn: async () => {
      const links = await rows<{ student_id: string }[]>(supabase.from('parent_links').select('student_id').eq('parent_id', profile!.id))
      if (!links.length) return []
      return rows<Child[]>(
        supabase.from('profiles').select('id, full_name, avatar_url, coin_balance, class_id')
          .in('id', links.map((l) => l.student_id)).order('full_name'),
      )
    },
  })
}

const TX_PAGE = 30

/** The child's ledger, newest first, a page at a time. */
export function useChildTransactions(childId: string) {
  return useInfiniteQuery({
    queryKey: parentKeys.tx(childId),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => rows<CoinTransaction[]>(
      supabase.from('coin_transactions').select('id, user_id, amount, direction, category, subject, reason, created_at')
        .eq('user_id', childId).order('created_at', { ascending: false }).range(pageParam, pageParam + TX_PAGE - 1),
    ),
    getNextPageParam: (last, all) => (last.length < TX_PAGE ? undefined : all.length * TX_PAGE),
  })
}

/** Lifetime earned / spent (same rule as the student's profile: earned excludes refunds). */
export function useChildTotals(childId: string) {
  return useQuery({
    queryKey: parentKeys.totals(childId),
    queryFn: async () => {
      const data = await rows<Pick<CoinTransaction, 'amount' | 'direction' | 'category'>[]>(
        supabase.from('coin_transactions').select('amount, direction, category').eq('user_id', childId),
      )
      let earned = 0, spent = 0
      for (const r of data) {
        if (r.direction === 'earn' && r.category !== 'purchase') earned += r.amount
        if (r.direction === 'spend') spent += r.amount
      }
      return { earned, spent }
    },
  })
}

/** Recent daily sets (today included) with item statuses. */
export function useChildDailySets(childId: string) {
  const today = schoolToday()
  return useQuery({
    queryKey: parentKeys.sets(childId),
    queryFn: () => fetchSetsWithProgress(childId, today),
  })
}

export function useChildStreaks(childId: string) {
  return useQuery({
    queryKey: parentKeys.streaks(childId),
    queryFn: () => rows<StudentStreak[]>(supabase.from('student_streaks').select('*').eq('user_id', childId)),
  })
}

/** Subject levels with their names (tells "not placed" apart from "no set today"). */
export function useChildLevels(childId: string) {
  return useQuery({
    queryKey: parentKeys.levels(childId),
    queryFn: () => rows<(StudentLevel & { levels: { name: string } | null })[]>(
      supabase.from('student_levels').select('*, levels(name)').eq('user_id', childId),
    ),
  })
}

/** School + class rank (null until the child appears on the board). */
export function useChildRank(childId: string) {
  return useQuery({
    queryKey: parentKeys.rank(childId),
    queryFn: () => rows<LeaderboardRow | null>(
      supabase.from('leaderboard_overall_visible').select('*').eq('user_id', childId).maybeSingle(),
    ),
  })
}

export function useChildSubjectRanks(childId: string) {
  return useQuery({
    queryKey: parentKeys.subjectRanks(childId),
    queryFn: () => rows<(LeaderboardRow & { subject: Subject })[]>(
      supabase.from('leaderboard_subject_visible').select('*').eq('user_id', childId),
    ),
  })
}
