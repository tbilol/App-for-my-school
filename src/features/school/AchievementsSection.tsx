import { useMemo } from 'react'
import { Hourglass, Lock } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { CoinAmount } from '@/components/CoinAmount'
import { useAchievementCatalog, useMyAchievements } from '@/features/school/api'
import { subjectStyle } from '@/features/school/components'
import { cn, formatDate } from '@/lib/utils'
import { fmt, useT } from '@/i18n'
import type { Achievement, CatalogItem } from '@/types/models'

type State = 'earned' | 'pending' | 'locked'

function AchievementCard({ item, mine, state }: { item: CatalogItem; mine?: Achievement; state: State }) {
  const t = useT()
  return (
    <li
      data-testid={`achievement-${state}`}
      className={cn('relative flex gap-3 rounded-xl border bg-card p-4',
        state === 'earned' && 'border-amber-300 bg-gradient-to-br from-amber-50 to-card dark:border-amber-700/50 dark:from-amber-950/40',
        state === 'locked' && 'bg-muted/60')}
    >
      <span className={cn('grid size-14 shrink-0 place-items-center rounded-xl text-3xl', state === 'locked' ? 'bg-secondary grayscale opacity-50' : 'bg-white shadow-xs dark:bg-secondary')} aria-hidden>
        {item.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className={cn('font-semibold', state === 'locked' && 'text-muted-foreground')}>{item.title}</h3>
          {state === 'locked' && <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <CoinAmount value={state === 'earned' && mine ? mine.coins_awarded : item.coins} className={cn('text-sm', state === 'locked' && 'opacity-70')} />
          {item.subject && <span className={cn('rounded-full px-2 py-0.5 font-medium', subjectStyle[item.subject])}>{t.subjects[item.subject]}</span>}
          {state === 'earned' && mine?.verified_at && (
            <span className="text-muted-foreground">· {t.achievementsPage.earnedOn}: {formatDate(mine.verified_at)}</span>
          )}
          {state === 'pending' && mine && (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 font-medium text-amber-700 dark:text-amber-300">
              <Hourglass className="size-3" /> {t.achievementsPage.pending} · {formatDate(mine.created_at)}
            </span>
          )}
        </div>
      </div>
    </li>
  )
}

/** Earned / under review / locked achievements for the signed-in student (shown in Profile → Yutuqlar). */
export function AchievementsSection() {
  const t = useT()
  const catalog = useAchievementCatalog()
  const mine = useMyAchievements()

  const groups = useMemo(() => {
    const byCatalog = new Map<string, Achievement>()
    // verified beats pending beats rejected for the same catalog entry
    const rank = { verified: 0, pending: 1, rejected: 2 } as const
    for (const a of mine.data ?? []) {
      if (!a.catalog_id) continue
      const cur = byCatalog.get(a.catalog_id)
      if (!cur || rank[a.status] < rank[cur.status]) byCatalog.set(a.catalog_id, a)
    }
    const out: Record<State, { item: CatalogItem; mine?: Achievement }[]> = { earned: [], pending: [], locked: [] }
    for (const item of catalog.data ?? []) {
      const a = byCatalog.get(item.id)
      const state: State = a?.status === 'verified' ? 'earned' : a?.status === 'pending' ? 'pending' : 'locked'
      out[state].push({ item, mine: a })
    }
    return out
  }, [catalog.data, mine.data])

  const total = catalog.data?.length ?? 0
  const earned = groups.earned.length

  return (
    <>
      {catalog.isPending || mine.isPending ? <Skeleton className="h-96 w-full" /> : (
        <>
          <div className="mb-5 rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">{fmt(t.achievementsPage.progress, { n: earned, total })}</span>
              <span className="text-2xl">{'🏅'.repeat(Math.min(earned, 5))}</span>
            </div>
            <Progress value={total ? (earned / total) * 100 : 0} className="mt-2 h-2" />
            <p className="mt-2 text-xs text-muted-foreground">{t.achievementsPage.howTo}</p>
          </div>
          {(['earned', 'pending', 'locked'] as const).map((state) => groups[state].length > 0 && (
            <section key={state} className="mb-6">
              <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {t.achievementsPage[state]} · {groups[state].length}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {groups[state].map(({ item, mine: m }) => <AchievementCard key={item.id} item={item} mine={m} state={state} />)}
              </ul>
            </section>
          ))}
        </>
      )}
    </>
  )
}
