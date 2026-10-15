import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownRight, ArrowUpRight, Eye } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { CoinAmount } from '@/components/CoinAmount'
import { UserAvatar } from '@/components/UserAvatar'
import { useAuth } from '@/features/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import { cn, formatCoins, formatDate } from '@/lib/utils'
import { useT } from '@/i18n'
import type { CoinTransaction, LeaderboardRow, Profile } from '@/types/models'

// Everything here is read through RLS: a parent can only ever load their linked children.

function useChildren(parentId: string | undefined) {
  return useQuery({
    queryKey: ['parent', 'children', parentId],
    enabled: !!parentId,
    queryFn: async () => {
      const { data: links, error } = await supabase.from('parent_links').select('student_id').eq('parent_id', parentId!)
      if (error) throw error
      if (!links.length) return []
      const { data, error: e2 } = await supabase
        .from('profiles').select('id, full_name, avatar_url, coin_balance, class_id')
        .in('id', links.map((l: { student_id: string }) => l.student_id)).order('full_name')
      if (e2) throw e2
      return data as Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'coin_balance' | 'class_id'>[]
    },
  })
}

function ChildDetail({ childId }: { childId: string }) {
  const t = useT()
  const rank = useQuery({
    queryKey: ['parent', 'rank', childId],
    queryFn: async () => {
      const { data, error } = await supabase.from('leaderboard_overall_visible').select('*').eq('user_id', childId).maybeSingle()
      if (error) throw error
      return data as LeaderboardRow | null
    },
  })
  const tx = useQuery({
    queryKey: ['parent', 'tx', childId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coin_transactions').select('id, amount, direction, category, subject, reason, created_at')
        .eq('user_id', childId).order('created_at', { ascending: false }).limit(20)
      if (error) throw error
      return data as CoinTransaction[]
    },
  })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">{t.parent.schoolRank}</div>
          <div className="mt-1 text-2xl font-bold tabular">{rank.data ? `#${rank.data.school_rank}` : '—'}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">{t.parent.classRank}{rank.data?.class_name ? ` · ${rank.data.class_name}` : ''}</div>
          <div className="mt-1 text-2xl font-bold tabular">{rank.data ? `#${rank.data.class_rank}` : '—'}</div>
        </div>
      </div>

      <section className="rounded-xl border bg-card">
        <h2 className="border-b px-4 py-3 text-sm font-semibold">{t.parent.recent}</h2>
        {tx.isPending ? <Skeleton className="m-4 h-24" /> : !tx.data?.length ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t.parent.noActivity}</p>
        ) : (
          <ul className="divide-y">
            {tx.data.map((r) => {
              const earn = r.direction === 'earn'
              return (
                <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={cn('grid size-8 shrink-0 place-items-center rounded-full', earn ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive')}>
                    {earn ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{r.reason || t.categories[r.category]}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.categories[r.category]}{r.subject ? ` · ${t.subjects[r.subject]}` : ''} · {formatDate(r.created_at)}
                    </div>
                  </div>
                  <span className={cn('text-sm font-semibold tabular', earn ? 'text-success' : 'text-destructive')}>
                    {earn ? '+' : '−'}{formatCoins(r.amount)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

export default function ParentHome() {
  const t = useT()
  const { profile } = useAuth()
  const children = useChildren(profile?.id)
  const [selected, setSelected] = useState<string | null>(null)
  const child = children.data?.find((c) => c.id === selected) ?? children.data?.[0]

  if (children.isPending) return <Skeleton className="h-64 w-full" />
  if (!child) return <p className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">{t.parent.noChildren}</p>

  return (
    <div className="space-y-4">
      {children.data!.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
          {children.data!.map((c) => (
            <button
              key={c.id} role="tab" aria-selected={c.id === child.id} onClick={() => setSelected(c.id)}
              className={cn('flex shrink-0 items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm font-medium',
                c.id === child.id ? 'border-primary bg-primary-soft text-primary' : 'bg-card')}
            >
              <UserAvatar name={c.full_name} url={c.avatar_url} className="size-7" /> {c.full_name.split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
        <div className="flex items-center gap-3">
          <UserAvatar name={child.full_name} url={child.avatar_url} className="size-12 ring-2 ring-white/30" />
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold">{child.full_name}</div>
            <div className="text-sm text-primary-foreground/90">{t.parent.balance}</div>
          </div>
        </div>
        <CoinAmount value={child.coin_balance} className="mt-4 text-4xl" iconClassName="size-8" />
      </div>

      <ChildDetail childId={child.id} />

      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground"><Eye className="size-3.5" /> {t.parent.readOnly}</p>
    </div>
  )
}
