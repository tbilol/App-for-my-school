import { useState } from 'react'
import { History, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CoinAmount } from '@/components/CoinAmount'
import { PageHeader } from '@/components/PageHeader'
import { useSelectedChild } from '@/components/layout/ParentLayout'
import { useChildTotals, useChildTransactions } from '@/features/parent/api'
import { EmptyState, SectionCard, TxRow } from '@/features/school/components'
import { cn, formatCoins } from '@/lib/utils'
import { useT } from '@/i18n'

/** The child's full coin ledger, newest first, with an earn/spend filter. */
export default function ParentCoinsPage() {
  const t = useT()
  const child = useSelectedChild()
  const tx = useChildTransactions(child.id)
  const totals = useChildTotals(child.id)
  const [filter, setFilter] = useState<'all' | 'earn' | 'spend'>('all')
  const shown = (tx.data?.pages.flat() ?? []).filter((r) => filter === 'all' || r.direction === filter)

  return (
    <div className="space-y-4">
      <PageHeader title={t.parent.coinsTitle} description={child.full_name} />

      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-2xl border bg-card p-3">
          <div className="text-xs text-muted-foreground">{t.parent.balance}</div>
          <CoinAmount value={child.coin_balance} className="mt-1 text-lg" />
        </div>
        <div className="rounded-2xl border bg-card p-3">
          <div className="text-xs text-muted-foreground">{t.parent.earned}</div>
          <div className="mt-1 text-lg font-semibold text-success tabular">{totals.data ? `+${formatCoins(totals.data.earned)}` : '—'}</div>
        </div>
        <div className="rounded-2xl border bg-card p-3">
          <div className="text-xs text-muted-foreground">{t.parent.spent}</div>
          <div className="mt-1 text-lg font-semibold text-destructive tabular">{totals.data ? `−${formatCoins(totals.data.spent)}` : '—'}</div>
        </div>
      </div>

      <SectionCard
        title={t.profile.history}
        className="rounded-2xl"
        action={
          <div className="flex gap-1" role="tablist">
            {(['all', 'earn', 'spend'] as const).map((f) => (
              <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
                className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', filter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary')}>
                {f === 'all' ? t.profile.filterAll : f === 'earn' ? t.profile.filterEarn : t.profile.filterSpend}
              </button>
            ))}
          </div>
        }
      >
        {tx.isPending ? <Skeleton className="m-4 h-40" /> : tx.isError ? (
          <p className="px-4 py-6 text-center text-sm text-destructive">{tx.error.message}</p>
        ) : !shown.length ? <EmptyState icon={History} text={t.parent.noActivity} /> : (
          <ul className="divide-y" data-testid="parent-history">{shown.map((r) => <TxRow key={r.id} tx={r} />)}</ul>
        )}
        {tx.hasNextPage && (
          <div className="border-t p-3 text-center">
            <Button variant="ghost" size="sm" disabled={tx.isFetchingNextPage} onClick={() => void tx.fetchNextPage()}>
              {tx.isFetchingNextPage && <Loader2 className="animate-spin" />} {t.profile.loadMore}
            </Button>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
