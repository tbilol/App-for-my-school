import { useMemo } from 'react'
import { CalendarDays, Medal } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/PageHeader'
import { useConfig, useEvents, useMyEventResults, schoolToday } from '@/features/school/api'
import { daysFrom, EmptyState, subjectStyle } from '@/features/school/components'
import { cn, formatCoins, formatDate } from '@/lib/utils'
import { fmt, useT } from '@/i18n'
import type { EventResult, EventRow } from '@/types/models'

type PlaceCoins = Record<string, number>

function EventCard({ ev, today, coins, result }: { ev: EventRow; today: string; coins: PlaceCoins | null; result?: EventResult }) {
  const t = useT()
  const d = daysFrom(ev.date, today)
  const [day, month] = formatDate(ev.date).split('.')
  const when = d === 0 ? t.eventsPage.today : d > 0 ? fmt(t.eventsPage.inDays, { n: d }) : fmt(t.eventsPage.daysAgo, { n: -d })
  return (
    <li className={cn('flex gap-3 rounded-xl border bg-card p-4', d < 0 && 'bg-muted/50')} data-testid={d >= 0 ? 'event-upcoming' : 'event-past'}>
      <div className={cn('flex w-14 shrink-0 flex-col items-center justify-center rounded-lg py-2', d >= 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground')}>
        <span className="text-xl leading-none font-bold tabular">{day}</span>
        <span className="text-[11px] uppercase">{month}-oy</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="font-semibold">{ev.title}</h3>
          {ev.subject && <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', subjectStyle[ev.subject])}>{t.subjects[ev.subject]}</span>}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{ev.description}</p>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className={cn('font-medium', d >= 0 && d <= 7 && 'text-primary')}>{when}</span>
          {coins && <span>🪙 {fmt(t.eventsPage.reward, { first: formatCoins(coins['1'] ?? 0), part: formatCoins(coins.participation ?? 0) })}</span>}
          {ev.coins_pool != null && <span>{fmt(t.eventsPage.pool, { n: formatCoins(ev.coins_pool) })}</span>}
        </div>
        {result && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success" data-testid="my-event-result">
            <Medal className="size-3.5" />
            {t.eventsPage.yourResult}: {result.place ? fmt(t.eventsPage.place, { n: result.place }) : t.eventsPage.participant} · +{formatCoins(result.coins_awarded)} coin
          </div>
        )}
      </div>
    </li>
  )
}

export default function EventsPage() {
  const t = useT()
  const events = useEvents()
  const results = useMyEventResults()
  const coins = useConfig<PlaceCoins>('event_place_coins')
  const today = schoolToday()

  const { upcoming, past } = useMemo(() => {
    const all = events.data ?? []
    return {
      upcoming: all.filter((e) => e.date.slice(0, 10) >= today),
      past: all.filter((e) => e.date.slice(0, 10) < today).reverse(),
    }
  }, [events.data, today])
  const resultBy = useMemo(() => new Map((results.data ?? []).map((r) => [r.event_id, r])), [results.data])

  return (
    <>
      <PageHeader title={t.eventsPage.title} description={t.eventsPage.subtitle} back={{ to: '/', label: t.eventsPage.backHome }} />
      {events.isPending ? <Skeleton className="h-96 w-full" /> : (
        <>
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t.eventsPage.upcoming}</h2>
          {upcoming.length === 0 ? <EmptyState icon={CalendarDays} text={t.eventsPage.noUpcoming} className="mb-6 rounded-xl border bg-card" /> : (
            <ul className="mb-6 space-y-3">{upcoming.map((e) => <EventCard key={e.id} ev={e} today={today} coins={coins.data ?? null} result={resultBy.get(e.id)} />)}</ul>
          )}
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t.eventsPage.past}</h2>
          {past.length === 0 ? <EmptyState icon={CalendarDays} text={t.eventsPage.noPast} className="rounded-xl border bg-card" /> : (
            <ul className="space-y-3">{past.map((e) => <EventCard key={e.id} ev={e} today={today} coins={coins.data ?? null} result={resultBy.get(e.id)} />)}</ul>
          )}
        </>
      )}
    </>
  )
}
