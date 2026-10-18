import { Link } from 'react-router-dom'
import { Activity, ChevronRight, GraduationCap, ListChecks, ShoppingBag, Target, Trophy, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { CoinAmount } from '@/components/CoinAmount'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  schoolToday, useClasses, useConfig, useLeaderboard, useMyTransactions, useShopItems,
} from '@/features/school/api'
import { HomeFeedPanel } from '@/features/school/HomeFeedPanel'
import { TodayCard } from '@/features/daily/TodayCard'
import { useMyDailySets } from '@/features/daily/api'
import { EmptyState, SectionCard, TxRow } from '@/features/school/components'
import { groupDailyTx } from '@/features/school/txGroups'
import { cn, formatCoins } from '@/lib/utils'
import { fmt, useT } from '@/i18n'

function QuickTile({ to, icon: Icon, label, value, tone }: { to: string; icon: LucideIcon; label: string; value: string; tone: string }) {
  return (
    <Link to={to} className="group flex flex-col gap-2 rounded-2xl border bg-card p-3 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-sm sm:p-4">
      <span className={cn('grid size-9 place-items-center rounded-xl', tone)}><Icon className="size-4.5" /></span>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex items-center justify-between gap-1 text-sm leading-tight font-semibold">
        <span className="min-w-0">{value}</span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}

export default function HomePage() {
  const t = useT()
  const { profile } = useAuth()
  const isStudent = profile?.role === 'student'
  const goal = useConfig<{ title: string; coins: number }>('big_goal')
  const board = useLeaderboard(null)
  // enough rows that the last 5 lines survive daily-task grouping
  const tx = useMyTransactions(40)
  const recent = groupDailyTx(tx.data ?? []).slice(0, 5)
  const classes = useClasses()
  const sets = useMyDailySets()
  const shop = useShopItems()
  const today = schoolToday()

  const balance = profile?.coin_balance ?? 0
  const firstName = profile?.full_name.split(' ')[0] ?? ''
  const className = classes.data?.find((c) => c.id === profile?.class_id)?.name
  const me = board.data?.find((r) => r.user_id === profile?.id)

  // Quick-tile numbers
  const todays = (sets.data ?? []).filter((s) => s.set_date === today)
  const todo = todays.filter((s) => s.status !== 'completed').length
  const affordable = (shop.data ?? []).filter((i) => i.stock > 0 && i.coin_price <= balance).length
  const goalPct = goal.data ? Math.min(100, (balance / goal.data.coins) * 100) : 0

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.home.greeting}, {firstName}! 👋</h1>
        <p className="mt-1 text-sm text-muted-foreground">{className ? `${className} · ` : ''}{t.home.subtitle}</p>
      </div>

      {isStudent ? (
        <>
          {/* Hero: balance + rank + big goal */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-violet-600 p-5 text-primary-foreground shadow-md sm:p-6" data-testid="balance-card">
            <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-white/10" />
            <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-10 size-40 rounded-full bg-white/5" />
            <div className="relative flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-primary-foreground/90">{t.home.balance}</div>
                <CoinAmount value={balance} className="mt-1 text-4xl sm:text-5xl" iconClassName="size-8 sm:size-10" />
              </div>
              {me && (
                <Link to="/ratings" className="rounded-2xl bg-white/15 px-3 py-2 text-center backdrop-blur-sm hover:bg-white/25">
                  <Trophy className="mx-auto size-4" />
                  <div className="text-lg font-bold tabular">#{me.school_rank}</div>
                  <div className="text-[10px] text-primary-foreground/90">{t.home.rank}</div>
                </Link>
              )}
            </div>
            {goal.data && (
              <div className="relative mt-5 rounded-2xl bg-black/10 p-3.5">
                <div className="text-[11px] font-medium tracking-wide text-primary-foreground/90 uppercase">{t.home.bigGoal}</div>
                <div className="mt-0.5 flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-1.5 font-medium"><Target className="size-4 shrink-0" /><span className="truncate">{goal.data.title}</span></span>
                  <span className="shrink-0 font-semibold tabular">{Math.floor(goalPct)}%</span>
                </div>
                <Progress value={goalPct} className="mt-2 h-2.5 bg-white/20 [&>div]:bg-amber-300" />
                <div className="mt-1.5 flex justify-between text-xs text-primary-foreground/90 tabular">
                  <span>{balance >= goal.data.coins ? t.home.goalReached : `${formatCoins(goal.data.coins - balance)} coin ${t.home.goalLeft}`}</span>
                  <span>{formatCoins(goal.data.coins)}</span>
                </div>
              </div>
            )}
          </div>

          <TodayCard />

          {/* Quick links */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3" data-testid="quick-tiles">
            <QuickTile to="/daily" icon={ListChecks} label={t.home.tileChallenges} tone="bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
              value={todo > 0 ? fmt(t.home.tileChallengesTodo, { n: todo }) : todays.length ? t.home.tileChallengesDone : '—'} />
            <QuickTile to="/shop" icon={ShoppingBag} label={t.home.tileShop} tone="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
              value={affordable > 0 ? fmt(t.home.tileShopCan, { n: affordable }) : t.home.tileShopNone} />
            <QuickTile to="/ratings" icon={Trophy} label={t.home.tileRating} tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
              value={me ? fmt(t.home.tileRatingRank, { n: me.school_rank }) : '—'} />
          </div>
        </>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border bg-card p-4">
          <GraduationCap className="size-8 shrink-0 text-primary" />
          <p className="flex-1 text-sm text-muted-foreground">{t.home.staffHint}</p>
          <Button asChild size="sm"><Link to="/teacher">{t.nav.teacher}</Link></Button>
        </div>
      )}

      <HomeFeedPanel />

      {isStudent && (
        <SectionCard title={t.home.recentActivity} to="/profile" className="rounded-2xl">
          {tx.isPending ? <Skeleton className="m-4 h-24" /> : !recent.length ? <EmptyState icon={Activity} text={t.home.noActivity} /> : (
            <ul className="divide-y" data-testid="recent-activity">{recent.map((r) => <TxRow key={r.id} tx={r} />)}</ul>
          )}
        </SectionCard>
      )}
    </div>
  )
}
