import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth, profileKey } from '@/features/auth/AuthProvider'
import { schoolToday, useConfig } from '@/features/school/api'
import type {
  DailyAnswer, DailyItem, DailyItemStatus, DailySet, DailySubmitResult, StudentLevel, StudentStreak, Subject,
} from '@/types/models'

// Student daily tasks. Reads are RLS-scoped to the caller's own rows; writes are
// ensure_my_today_sets() + submit_daily_item() (20261022000000_student_daily.sql).

async function rows<T>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p
  if (error) throw new Error(error.message)
  return data as T
}
async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

/** How far back the past-days list goes. */
export const PAST_DAYS = 21

export interface DailySetWithProgress extends DailySet { items: { status: DailyItemStatus }[] }

export const dailyKeys = {
  ensure: (day: string) => ['daily', 'ensure', day] as const,
  sets: ['daily', 'sets'] as const,
  items: (setId: string) => ['daily', 'items', setId] as const,
  streaks: ['daily', 'streaks'] as const,
  levels: ['daily', 'my-levels'] as const,
}

/** ISO date `days` before `day` (both YYYY-MM-DD). */
export function minusDays(day: string, days: number) {
  const d = new Date(day + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

/**
 * Creates today's sets if the midnight job hasn't yet (idempotent, today only).
 * The set list waits for it, so a freshly placed student sees tasks at once.
 */
export function useEnsureTodaySets() {
  const { profile } = useAuth()
  const today = schoolToday()
  const qc = useQueryClient()
  return useQuery({
    queryKey: dailyKeys.ensure(today),
    enabled: profile?.role === 'student',
    staleTime: Infinity,
    retry: 1,
    queryFn: async () => {
      const n = await rpc<number>('ensure_my_today_sets')
      if (n > 0) qc.invalidateQueries({ queryKey: dailyKeys.sets })
      // the call may also have zeroed a broken streak
      qc.invalidateQueries({ queryKey: dailyKeys.streaks })
      return n
    },
  })
}

/** The caller's sets for the last PAST_DAYS days (today included), newest first, with item statuses. */
export function useMyDailySets() {
  const { profile } = useAuth()
  const ensure = useEnsureTodaySets()
  const today = schoolToday()
  return useQuery({
    queryKey: dailyKeys.sets,
    // wait for ensure (a failure there must not hide existing sets)
    enabled: !!profile && !ensure.isPending,
    queryFn: () => fetchSetsWithProgress(profile!.id, today),
  })
}

/** `userId`'s sets for the last PAST_DAYS days up to `today`, newest first (also used by the parent portal). */
export async function fetchSetsWithProgress(userId: string, today: string) {
  const data = await rows<(DailySet & { daily_items: { status: DailyItemStatus }[] })[]>(
    supabase.from('daily_sets').select('*, daily_items(status)')
      .eq('user_id', userId).gte('set_date', minusDays(today, PAST_DAYS)).lte('set_date', today)
      .order('set_date', { ascending: false }),
  )
  return data.map<DailySetWithProgress>(({ daily_items, ...s }) => ({ ...s, items: daily_items ?? [] }))
}

export function useDailyItems(setId: string | undefined) {
  return useQuery({
    queryKey: dailyKeys.items(setId ?? ''),
    enabled: !!setId,
    queryFn: () => rows<DailyItem[]>(supabase.from('daily_items').select('*').eq('set_id', setId!).order('ord')),
  })
}

/** Per-subject rows + the overall row (subject null). */
export function useMyStreaks() {
  const { profile } = useAuth()
  return useQuery({
    queryKey: dailyKeys.streaks,
    enabled: !!profile,
    queryFn: () => rows<StudentStreak[]>(supabase.from('student_streaks').select('*').eq('user_id', profile!.id)),
  })
}

/** The caller's own levels: tells "not placed" apart from "placed, no set today". */
export function useMyLevels() {
  const { profile } = useAuth()
  return useQuery({
    queryKey: dailyKeys.levels,
    enabled: !!profile,
    queryFn: () => rows<StudentLevel[]>(supabase.from('student_levels').select('*').eq('user_id', profile!.id)),
  })
}

/** Is `day` a school day (app_config.streak_skip_weekdays, default Sunday)? */
export function useIsSchoolDay(day: string) {
  const skip = useConfig<number[]>('streak_skip_weekdays')
  const dow = new Date(day + 'T00:00:00Z').getUTCDay()
  return !(skip.data ?? [0]).includes(dow)
}

/**
 * Answers one item. The result carries the correct answer (choice/exact) and the
 * set's state; the item cache is patched right away so the runner can show
 * feedback, then sets/streaks/balance refresh.
 */
export function useSubmitDailyItem() {
  const qc = useQueryClient()
  const { profile } = useAuth()
  return useMutation({
    mutationFn: (a: { itemId: string; answer: DailyAnswer }) =>
      rpc<DailySubmitResult>('submit_daily_item', { p_item: a.itemId, p_answer: a.answer }),
    onSuccess: (r) => {
      qc.setQueryData<DailyItem[]>(dailyKeys.items(r.set_id), (old) => old?.map((i) => (i.id === r.id ? { ...i, ...r } : i)))
      qc.invalidateQueries({ queryKey: dailyKeys.sets })
      if (r.set_status === 'completed') qc.invalidateQueries({ queryKey: dailyKeys.streaks })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: profileKey(profile?.id) })
    },
  })
}

/** "12.10.2026" from a YYYY-MM-DD date (no timezone shifting). */
export function formatDay(day: string) {
  const [y, m, d] = day.slice(0, 10).split('-')
  return `${d}.${m}.${y}`
}

export const SUBJECT_ORDER: Subject[] = ['english', 'math', 'it']
