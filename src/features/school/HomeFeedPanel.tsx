import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ChevronDown, ChevronRight, Megaphone, Pin } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatCoins, formatDate } from '@/lib/utils'
import { fmt, useT } from '@/i18n'
import { schoolToday, useAnnouncements, useConfig, useEvents } from './api'
import { daysFrom } from './components'

const RECENT_DAYS = 3   // announcements newer than this get the "Yangi" dot

/**
 * One card on Home that replaces the two inline feeds. Collapsed by default;
 * expands in place to show the latest announcements and the next events, each
 * with a link to its full page.
 */
export function HomeFeedPanel({ announcementsTo = '/announcements', eventsTo = '/events' }: { announcementsTo?: string; eventsTo?: string } = {}) {
  const t = useT()
  const id = useId()
  const [open, setOpen] = useState(false)
  const feed = useAnnouncements()
  const events = useEvents()
  const placeCoins = useConfig<Record<string, number>>('event_place_coins')
  const today = schoolToday()

  const announcements = feed.data ?? []
  const upcoming = (events.data ?? []).filter((e) => e.date.slice(0, 10) >= today)
  const fresh = announcements.filter((a) => -daysFrom(a.created_at, today) <= RECENT_DAYS).length

  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-xs" data-testid="feed-panel">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/60"
      >
        <span className="relative grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-violet-500 text-white">
          <Megaphone className="size-5" />
          {fresh > 0 && <span className="absolute -top-1 -right-1 size-3.5 rounded-full bg-destructive ring-2 ring-card" aria-hidden />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="font-semibold">{t.home.feedTitle}</span>
            {fresh > 0 && <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold text-destructive uppercase">{fresh} {t.home.feedNew}</span>}
          </span>
          <span className="block truncate text-sm text-muted-foreground">
            {feed.isPending || events.isPending ? '…' : fmt(t.home.feedSummary, { a: announcements.length, e: upcoming.length })}
          </span>
        </span>
        <ChevronDown className={cn('size-5 shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {/* grid-rows trick: animates height without measuring */}
      <div id={id} className={cn('grid transition-[grid-template-rows] duration-300 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')} inert={!open}>
        {/* min-w-0 on grid children: otherwise long one-line titles widen the column past the card */}
        <div className="min-w-0 overflow-hidden">
          <div className="grid gap-4 border-t p-4 md:grid-cols-2">
            <div className="min-w-0">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <Megaphone className="size-3.5" /> {t.home.announcements}
              </h3>
              {feed.isPending ? <Skeleton className="h-24" /> : (
                <ul className="space-y-2" data-testid="feed-announcements">
                  {announcements.slice(0, 3).map((a) => (
                    <li key={a.id} className={cn('rounded-xl bg-muted/70 p-3', a.pinned && 'bg-primary-soft')}>
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        {a.pinned && <Pin className="size-3.5 shrink-0 text-primary" />}
                        <span className="truncate">{a.title}</span>
                      </div>
                      {a.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{a.body}</p>}
                      <div className="mt-1 text-[11px] text-muted-foreground">{a.author_name} · {formatDate(a.created_at)}</div>
                    </li>
                  ))}
                </ul>
              )}
              <Link to={announcementsTo} className="mt-2 inline-flex items-center gap-0.5 text-sm font-medium text-primary hover:underline">
                {t.home.allAnnouncements} <ChevronRight className="size-4" />
              </Link>
            </div>

            <div className="min-w-0">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <CalendarDays className="size-3.5" /> {t.home.upcomingEvents}
              </h3>
              {events.isPending ? <Skeleton className="h-24" /> : !upcoming.length ? (
                <p className="rounded-xl bg-muted/70 p-3 text-sm text-muted-foreground">{t.eventsPage.noUpcoming}</p>
              ) : (
                <ul className="space-y-2" data-testid="feed-events">
                  {upcoming.slice(0, 3).map((e) => {
                    const d = daysFrom(e.date, today)
                    const [day, month] = formatDate(e.date).split('.')
                    return (
                      <li key={e.id} className="flex items-center gap-3 rounded-xl bg-muted/70 p-3">
                        <span className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-primary py-1 text-primary-foreground">
                          <span className="text-base leading-none font-bold tabular">{day}</span>
                          <span className="text-[9px] uppercase">{month}-oy</span>
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{e.title}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {d === 0 ? t.eventsPage.today : fmt(t.eventsPage.inDays, { n: d })}
                            {placeCoins.data?.['1'] ? ` · 🪙 ${formatCoins(placeCoins.data['1'])}` : ''}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
              <Link to={eventsTo} className="mt-2 inline-flex items-center gap-0.5 text-sm font-medium text-primary hover:underline">
                {t.home.allEvents} <ChevronRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
