import { Eye, History } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { CoinAmount } from '@/components/CoinAmount'
import { UserAvatar } from '@/components/UserAvatar'
import { useSelectedChild } from '@/components/layout/ParentLayout'
import { useChildTransactions } from '@/features/parent/api'
import { StreakAndRank, TodayStatus } from '@/features/parent/components'
import { useClasses } from '@/features/school/api'
import { HomeFeedPanel } from '@/features/school/HomeFeedPanel'
import { EmptyState, SectionCard, TxRow } from '@/features/school/components'
import { groupDailyTx } from '@/features/school/txGroups'
import { useT } from '@/i18n'

/** Parent overview: balance, today's tasks, streak, rank, latest coins. */
export default function ParentHome() {
  const t = useT()
  const child = useSelectedChild()
  const classes = useClasses()
  const tx = useChildTransactions(child.id)
  const className = classes.data?.find((c) => c.id === child.class_id)?.name
  const recent = groupDailyTx(tx.data?.pages[0] ?? []).slice(0, 5)

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-violet-600 p-5 text-primary-foreground shadow-md" data-testid="child-hero">
        <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-3">
          <UserAvatar name={child.full_name} url={child.avatar_url} className="size-12 ring-2 ring-white/30" />
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold">{child.full_name}</div>
            {className && <div className="text-sm text-primary-foreground/90">{className}</div>}
          </div>
        </div>
        <div className="relative mt-4 text-sm text-primary-foreground/90">{t.parent.balance}</div>
        <CoinAmount value={child.coin_balance} className="relative text-4xl" iconClassName="size-8" />
      </div>

      <SectionCard title={t.parent.today} to="/parent/daily" className="rounded-2xl">
        <TodayStatus childId={child.id} />
      </SectionCard>

      <StreakAndRank childId={child.id} />

      <HomeFeedPanel announcementsTo="/parent/school" eventsTo="/parent/school?tab=events" />

      <SectionCard title={t.parent.recent} to="/parent/coins" className="rounded-2xl">
        {tx.isPending ? <Skeleton className="m-4 h-24" /> : !recent.length ? <EmptyState icon={History} text={t.parent.noActivity} /> : (
          <ul className="divide-y">{recent.map((r) => <TxRow key={r.id} tx={r} />)}</ul>
        )}
      </SectionCard>

      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground"><Eye className="size-3.5" /> {t.parent.readOnly}</p>
    </div>
  )
}
