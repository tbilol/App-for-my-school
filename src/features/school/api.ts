import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth, profileKey } from '@/features/auth/AuthProvider'
import type {
  Achievement, Announcement, CatalogItem, Challenge, ClassRow, CoinTransaction, EventResult, EventRow,
  LeaderboardRow, Order, ShopItem, Subject, Submission,
} from '@/types/models'

// Reads for the student-facing sections. Every query is narrowed by RLS on the
// server (a student only ever receives their own ledger, orders, submissions…).

async function rows<T>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p
  if (error) throw new Error(error.message)
  return data as T
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

/** School-local date (YYYY-MM-DD) — matches private.school_today() for daily limits. */
export function schoolToday(tz = 'Asia/Tashkent') {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

// ───────── config ─────────
export function useConfig<T>(key: string) {
  return useQuery({
    queryKey: ['config', key],
    staleTime: 5 * 60_000,
    queryFn: async () => (await rows<{ value: T }[]>(supabase.from('app_config').select('value').eq('key', key)))[0]?.value ?? null,
  })
}

export const useClasses = () =>
  useQuery({
    queryKey: ['classes'],
    staleTime: 5 * 60_000,
    queryFn: () => rows<ClassRow[]>(supabase.from('classes').select('id, name, grade').order('grade').order('name')),
  })

// ───────── ledger ─────────
export function useMyTransactions(limit = 50) {
  const { profile } = useAuth()
  return useQuery({
    queryKey: ['transactions', profile?.id, limit],
    enabled: !!profile,
    queryFn: () => rows<CoinTransaction[]>(
      supabase.from('coin_transactions').select('id, user_id, amount, direction, category, subject, reason, created_at')
        .eq('user_id', profile!.id).order('created_at', { ascending: false }).limit(limit),
    ),
  })
}

/** Lifetime totals for the profile header (earned excludes refunds). */
export function useMyTotals() {
  const { profile } = useAuth()
  return useQuery({
    queryKey: ['transactions', profile?.id, 'totals'],
    enabled: !!profile,
    queryFn: async () => {
      const data = await rows<Pick<CoinTransaction, 'amount' | 'direction' | 'category'>[]>(
        supabase.from('coin_transactions').select('amount, direction, category').eq('user_id', profile!.id),
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

// ───────── shop ─────────
export const useShopItems = () =>
  useQuery({
    queryKey: ['shop', 'items'],
    queryFn: () => rows<ShopItem[]>(supabase.from('shop_items').select('*').eq('active', true).order('sort_order')),
  })

export function useMyOrders() {
  const { profile } = useAuth()
  return useQuery({
    queryKey: ['shop', 'orders', profile?.id],
    enabled: !!profile,
    queryFn: () => rows<Order[]>(supabase.from('orders').select('*').eq('user_id', profile!.id).order('created_at', { ascending: false })),
  })
}

/** Existing purchase flow: redeem_item() checks balance + stock and writes the ledger. */
export function useRedeem() {
  const qc = useQueryClient()
  const { profile } = useAuth()
  return useMutation({
    mutationFn: (itemId: string) => rpc<Order>('redeem_item', { p_item: itemId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shop'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: profileKey(profile?.id) })
    },
  })
}

// ───────── leaderboard ─────────
export function useLeaderboard(subject: Subject | null) {
  return useQuery({
    queryKey: ['leaderboard', subject ?? 'overall'],
    queryFn: () => subject
      ? rows<LeaderboardRow[]>(supabase.from('leaderboard_subject_visible').select('*').eq('subject', subject).order('school_rank').order('full_name'))
      : rows<LeaderboardRow[]>(supabase.from('leaderboard_overall_visible').select('*').order('school_rank').order('full_name')),
  })
}

/** Any coin movement bumps leaderboard_ticks; refetch the boards when it does. */
export function useLeaderboardRealtime() {
  const qc = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel('leaderboard')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leaderboard_ticks' }, () =>
        qc.invalidateQueries({ queryKey: ['leaderboard'] }))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [qc])
}

// ───────── achievements ─────────
export const useAchievementCatalog = () =>
  useQuery({
    queryKey: ['achievements', 'catalog'],
    queryFn: () => rows<CatalogItem[]>(supabase.from('achievement_catalog').select('*').eq('active', true).order('sort_order')),
  })

export function useMyAchievements() {
  const { profile } = useAuth()
  return useQuery({
    queryKey: ['achievements', 'mine', profile?.id],
    enabled: !!profile,
    queryFn: () => rows<Achievement[]>(supabase.from('achievements').select('*').eq('user_id', profile!.id).order('created_at', { ascending: false })),
  })
}

// ───────── events ─────────
export const useEvents = () =>
  useQuery({
    queryKey: ['events'],
    queryFn: () => rows<EventRow[]>(supabase.from('events').select('id, title, description, date, subject, coins_pool').order('date')),
  })

export function useMyEventResults() {
  const { profile } = useAuth()
  return useEventResults(profile?.id)
}

/** A member's event results (own, or a parent's child — RLS: can_view_member). */
export function useEventResults(userId: string | undefined) {
  return useQuery({
    queryKey: ['events', 'results', userId],
    enabled: !!userId,
    queryFn: () => rows<EventResult[]>(supabase.from('event_results').select('id, event_id, user_id, place, coins_awarded').eq('user_id', userId!)),
  })
}

// ───────── announcements ─────────
export function useAnnouncements(limit?: number) {
  const qc = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel('announcements')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () =>
        qc.invalidateQueries({ queryKey: ['announcements'] }))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [qc])
  return useQuery({
    queryKey: ['announcements', limit ?? 'all'],
    queryFn: () => {
      let q = supabase.from('announcements').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false })
      if (limit) q = q.limit(limit)
      return rows<Announcement[]>(q)
    },
  })
}

export function useAnnouncementMutations() {
  const qc = useQueryClient()
  const done = () => qc.invalidateQueries({ queryKey: ['announcements'] })
  return {
    create: useMutation({
      // created_by / author_name are stamped server-side
      mutationFn: async (a: { title: string; body: string; pinned: boolean }) => {
        const { error } = await supabase.from('announcements').insert({ title: a.title.trim(), body: a.body.trim(), pinned: a.pinned })
        if (error) throw new Error(error.message)
      },
      onSuccess: done,
    }),
    remove: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from('announcements').delete().eq('id', id)
        if (error) throw new Error(error.message)
      },
      onSuccess: done,
    }),
  }
}

// ───────── challenges ─────────
export const useChallenges = () =>
  useQuery({
    queryKey: ['challenges'],
    queryFn: () => rows<Challenge[]>(supabase.from('challenges').select('id, subject, title, description, type, recurrence, coins_reward, content, pass_score, streak_days').eq('active', true).order('created_at')),
  })

export function useMySubmissions() {
  const { profile } = useAuth()
  return useQuery({
    queryKey: ['submissions', profile?.id],
    enabled: !!profile,
    queryFn: () => rows<Submission[]>(supabase.from('challenge_submissions').select('id, challenge_id, status, score, coins_awarded, submitted_on, created_at').eq('user_id', profile!.id).order('submitted_on', { ascending: false })),
  })
}

export function useSubmitChallenge() {
  const qc = useQueryClient()
  const { profile } = useAuth()
  return useMutation({
    mutationFn: (a: { challengeId: string; answer?: string; quizAnswers?: Record<string, number> }) =>
      rpc<Submission>('submit_challenge', { p_challenge: a.challengeId, p_answer: a.answer ?? null, p_quiz_answers: a.quizAnswers ?? null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['submissions'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: profileKey(profile?.id) })
    },
  })
}
