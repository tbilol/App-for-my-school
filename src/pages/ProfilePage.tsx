import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronRight, History } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CoinAmount } from '@/components/CoinAmount'
import { UserAvatar } from '@/components/UserAvatar'
import { useAuth } from '@/features/auth/AuthProvider'
import { useAchievementCatalog, useClasses, useLeaderboard, useMyAchievements, useMyTotals, useMyTransactions } from '@/features/school/api'
import { SettingsSection } from '@/features/profile/SettingsSection'
import { AchievementsSection } from '@/features/school/AchievementsSection'
import { EmptyState, SectionCard, TxRow } from '@/features/school/components'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'

export default function ProfilePage() {
  const t = useT()
  const { profile } = useAuth()
  const isStudent = profile?.role === 'student'
  const [limit, setLimit] = useState(30)
  const [filter, setFilter] = useState<'all' | 'earn' | 'spend'>('all')
  // ?tab=achievements / ?tab=settings deep-link straight to that tab
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'achievements' ? 'achievements' : params.get('tab') === 'settings' ? 'settings' : 'overview'
  const setTab = (v: string) => setParams(v === 'overview' ? {} : { tab: v }, { replace: true })
  const tx = useMyTransactions(limit)
  const totals = useMyTotals()
  const classes = useClasses()
  const board = useLeaderboard(null)
  const catalog = useAchievementCatalog()
  const mine = useMyAchievements()

  const className = classes.data?.find((c) => c.id === profile?.class_id)?.name
  const me = board.data?.find((r) => r.user_id === profile?.id)
  const earnedBadges = useMemo(() => {
    const ids = new Set((mine.data ?? []).filter((a) => a.status === 'verified').map((a) => a.catalog_id))
    return (catalog.data ?? []).filter((c) => ids.has(c.id))
  }, [catalog.data, mine.data])
  const shown = (tx.data ?? []).filter((r) => filter === 'all' || r.direction === filter)

  if (!profile) return null
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-2xl border bg-card p-5">
        <UserAvatar name={profile.full_name} url={profile.avatar_url} className="size-16 text-lg" />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{profile.full_name}</h1>
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-muted-foreground">
            <span>{t.roles[profile.role]}{className ? ` · ${className}` : ''}</span>
            <span>{t.profile.login}: <span className="font-mono">{profile.login}</span></span>
          </div>
        </div>
      </div>

      {isStudent && (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4 grid w-full grid-cols-3 sm:w-[28rem]">
            <TabsTrigger value="overview">{t.profile.overview}</TabsTrigger>
            <TabsTrigger value="achievements">{t.profile.achievements} · {earnedBadges.length}</TabsTrigger>
            <TabsTrigger value="settings">{t.profile.settings}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="profile-stats">
              {[
                [t.coins.balance, <CoinAmount key="b" value={profile.coin_balance} className="text-xl" />],
                [t.profile.totalEarned, <CoinAmount key="e" value={totals.data?.earned ?? 0} className="text-xl text-success" />],
                [t.profile.totalSpent, <CoinAmount key="s" value={totals.data?.spent ?? 0} className="text-xl" />],
                [t.profile.rank, <span key="r" className="text-xl font-bold tabular">{me ? `#${me.school_rank}` : '—'}</span>],
              ].map(([label, value], i) => (
                <div key={i} className="rounded-xl border bg-card p-3">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="mt-1">{value}</div>
                </div>
              ))}
            </div>

            {earnedBadges.length > 0 && (
              <button
                type="button" onClick={() => setTab('achievements')}
                className="flex w-full items-center gap-3 rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 to-card dark:border-amber-700/50 dark:from-amber-950/40 p-3 text-left hover:shadow-xs"
              >
                <span className="flex -space-x-2">
                  {earnedBadges.slice(0, 4).map((b) => (
                    <span key={b.id} className="grid size-9 place-items-center rounded-full bg-white text-lg ring-2 ring-amber-50 dark:bg-secondary dark:ring-amber-950">{b.emoji}</span>
                  ))}
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium">{t.profile.achievements}: {earnedBadges.map((b) => b.title).join(', ')}</span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            )}

            <SectionCard
              title={t.profile.history}
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
              {tx.isPending ? <Skeleton className="m-4 h-40" /> : !shown.length ? <EmptyState icon={History} text={t.profile.noHistory} /> : (
                <>
                  <ul className="divide-y" data-testid="history">{shown.map((r) => <TxRow key={r.id} tx={r} />)}</ul>
                  {tx.data && tx.data.length >= limit && (
                    <div className="border-t p-3 text-center">
                      <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + 30)}>{t.profile.loadMore}</Button>
                    </div>
                  )}
                </>
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="achievements">
            <AchievementsSection />
          </TabsContent>

          <TabsContent value="settings">
            <SettingsSection />
          </TabsContent>
        </Tabs>
      )}

      {/* Staff have no student tabs — settings (incl. sign-out) go straight under the header. */}
      {!isStudent && <SettingsSection />}
    </div>
  )
}
