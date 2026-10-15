import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Achievement, CatalogItem, EventResult, EventRow, Order, OrderStatus, ShopItem } from '@/types/models'

// Admin-only reads/writes. RLS restricts every table here to the admin role.

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
function useAdminMutation<A, R>(fn: (a: A) => Promise<R>, keys: string[][]) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => keys.forEach((k) => qc.invalidateQueries({ queryKey: k })) })
}

// ───────── shop ─────────
export const useAllShopItems = () =>
  useQuery({ queryKey: ['admin', 'shop'], queryFn: () => rows<ShopItem[]>(supabase.from('shop_items').select('*').order('sort_order')) })

export type ShopItemInput = Omit<ShopItem, 'id' | 'image_url'> & { id?: string }
export const useSaveShopItem = () =>
  useAdminMutation(async (item: ShopItemInput) => {
    const { error } = item.id
      ? await supabase.from('shop_items').update(item).eq('id', item.id)
      : await supabase.from('shop_items').insert(item)
    if (error) throw new Error(error.message)
  }, [['admin', 'shop'], ['shop']])

// ───────── orders ─────────
export const useAllOrders = () =>
  useQuery({ queryKey: ['admin', 'orders'], queryFn: () => rows<Order[]>(supabase.from('orders').select('*').order('created_at', { ascending: false })) })

export const useReviewOrder = () =>
  useAdminMutation((a: { id: string; status: OrderStatus }) => rpc<Order>('review_order', { p_order: a.id, p_status: a.status }),
    [['admin', 'orders'], ['admin', 'shop'], ['shop'], ['manage']])

// ───────── achievements ─────────
export const useAllAchievements = () =>
  useQuery({ queryKey: ['admin', 'achievements'], queryFn: () => rows<Achievement[]>(supabase.from('achievements').select('*').order('created_at', { ascending: false })) })

export const useAllCatalog = () =>
  useQuery({ queryKey: ['admin', 'catalog'], queryFn: () => rows<CatalogItem[]>(supabase.from('achievement_catalog').select('*').order('sort_order')) })

/** Coins suggested by app_config.achievement_coins for this achievement (null = admin decides). */
export const useSuggestedCoins = (a: Achievement | null) =>
  useQuery({
    queryKey: ['admin', 'suggest', a?.id],
    enabled: !!a,
    queryFn: () => rpc<number | null>('suggest_achievement_coins', { p_type: a!.type, p_score: a!.score, p_level: null }),
  })

export const useReviewAchievement = () =>
  useAdminMutation((a: { id: string; approve: boolean; coins?: number }) =>
    rpc<Achievement>('review_achievement', { p_achievement: a.id, p_approve: a.approve, p_coins: a.coins ?? null }),
    [['admin', 'achievements'], ['achievements'], ['manage']])

export type CatalogInput = Omit<CatalogItem, 'id'> & { id?: string }
export const useSaveCatalogItem = () =>
  useAdminMutation(async (c: CatalogInput) => {
    const { error } = c.id
      ? await supabase.from('achievement_catalog').update(c).eq('id', c.id)
      : await supabase.from('achievement_catalog').insert(c)
    if (error) throw new Error(error.message)
  }, [['admin', 'catalog'], ['achievements']])

// ───────── events ─────────
export const useAllEvents = () =>
  useQuery({ queryKey: ['admin', 'events'], queryFn: () => rows<EventRow[]>(supabase.from('events').select('id, title, description, date, subject, coins_pool').order('date', { ascending: false })) })

export const useEventResults = (eventId: string | null) =>
  useQuery({
    queryKey: ['admin', 'event-results', eventId],
    enabled: !!eventId,
    queryFn: () => rows<EventResult[]>(supabase.from('event_results').select('id, event_id, user_id, place, coins_awarded').eq('event_id', eventId!).order('place', { nullsFirst: false })),
  })

export type EventInput = Omit<EventRow, 'id'> & { id?: string }
export const useSaveEvent = () =>
  useAdminMutation(async (e: EventInput) => {
    const { error } = e.id
      ? await supabase.from('events').update(e).eq('id', e.id)
      : await supabase.from('events').insert(e)
    if (error) throw new Error(error.message)
  }, [['admin', 'events'], ['events']])

export const useRecordResult = () =>
  useAdminMutation((a: { eventId: string; userId: string; place: number | null }) =>
    rpc<EventResult>('record_event_result', { p_event: a.eventId, p_user: a.userId, p_place: a.place }),
    [['admin', 'event-results'], ['events'], ['manage']])

// ───────── economy (app_config) ─────────
export const useAllConfig = () =>
  useQuery({
    queryKey: ['admin', 'config'],
    queryFn: async () => Object.fromEntries((await rows<{ key: string; value: unknown }[]>(supabase.from('app_config').select('key, value'))).map((r) => [r.key, r.value])) as Record<string, unknown>,
  })

export const useSaveConfig = () =>
  useAdminMutation(async (entries: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(entries)) {
      const { error } = await supabase.from('app_config').update({ value, updated_at: new Date().toISOString() }).eq('key', key)
      if (error) throw new Error(error.message)
    }
  }, [['admin', 'config'], ['config']])
