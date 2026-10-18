import { useEffect, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarClock, ChevronRight, CircleCheck, Coffee, GraduationCap, History, Info, PackageOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/PageHeader'
import {
  SUBJECT_ORDER, formatDay, useIsSchoolDay, useMyDailySets, useMyLevels, useMyStreaks, type DailySetWithProgress,
} from '@/features/daily/api'
import { StateChip, StreakHero, SubjectIcon, answeredCount, setState } from '@/features/daily/components'
import { SetRunner } from '@/features/daily/SetRunner'
import { schoolToday } from '@/features/school/api'
import { subjectStyle } from '@/features/school/components'
import { cn } from '@/lib/utils'
import { fmt, useT } from '@/i18n'
import type { Subject } from '@/types/models'

/** One subject's card on the today hub. */
function SubjectCard({ subject, set, placed, onOpen }: {
  subject: Subject; set: DailySetWithProgress | undefined; placed: boolean; onOpen: (id: string) => void
}) {
  const t = useT()
  const done = set?.status === 'completed'
  const n = set ? answeredCount(set) : 0
  const total = set?.items.length ?? 0
  return (
    <li className={cn('rounded-2xl border bg-card p-4 transition-shadow', set && !done && 'shadow-xs')} data-testid={`subject-${subject}`}>
      <div className="flex items-center gap-3">
        <span className={cn('grid size-12 shrink-0 place-items-center rounded-2xl', subjectStyle[subject])}>
          <SubjectIcon subject={subject} className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{t.subjects[subject]}</h3>
          {set ? (
            done ? (
              <p className="flex items-center gap-1 text-sm font-medium text-success"><CircleCheck className="size-4" /> {t.daily.done}</p>
            ) : (
              <p className="text-sm text-muted-foreground tabular">{fmt(t.daily.progress, { done: n, total })}</p>
            )
          ) : (
            <p className="text-sm text-muted-foreground">{placed ? t.daily.noPool : t.daily.notPlaced}</p>
          )}
        </div>
        {set && !done && (
          <Button onClick={() => onOpen(set.id)} className="shrink-0 rounded-xl">
            {n > 0 ? t.daily.continue : t.daily.start}
          </Button>
        )}
        {!set && !placed && <GraduationCap className="size-5 shrink-0 text-muted-foreground/60" />}
        {!set && placed && <PackageOpen className="size-5 shrink-0 text-muted-foreground/60" />}
      </div>
      {set && !done && <Progress value={(n / Math.max(total, 1)) * 100} className="mt-3 h-2" />}
    </li>
  )
}

function PastDays({ sets, onOpen }: { sets: DailySetWithProgress[]; onOpen: (id: string) => void }) {
  const t = useT()
  const byDay = useMemo(() => {
    const m = new Map<string, DailySetWithProgress[]>()
    for (const s of sets) m.set(s.set_date, [...(m.get(s.set_date) ?? []), s])
    return [...m.entries()].map(([day, list]) => [day, list.sort((a, b) => SUBJECT_ORDER.indexOf(a.subject) - SUBJECT_ORDER.indexOf(b.subject))] as const)
  }, [sets])

  return (
    <div className="mx-auto max-w-xl space-y-4" data-testid="past-days">
      <PageHeader title={t.daily.past} back={{ to: '/daily', label: t.daily.back }} />
      <p className="flex gap-2 rounded-2xl bg-primary-soft px-4 py-3 text-sm text-primary">
        <Info className="mt-0.5 size-4 shrink-0" /> {t.daily.pastHint}
      </p>
      {byDay.length === 0 ? (
        <p className="rounded-2xl border border-dashed bg-muted p-8 text-center text-sm text-muted-foreground">{t.daily.pastEmpty}</p>
      ) : (
        <ul className="space-y-3">
          {byDay.map(([day, list]) => (
            <li key={day} className="rounded-2xl border bg-card">
              <div className="flex items-center gap-2 border-b px-4 py-2.5 text-sm">
                <CalendarClock className="size-4 text-muted-foreground" />
                <span className="font-semibold">{t.daily.weekdays[new Date(day + 'T00:00:00Z').getUTCDay()]}</span>
                <span className="text-muted-foreground tabular">{formatDay(day)}</span>
              </div>
              <ul className="divide-y">
                {list.map((s) => {
                  const state = setState(s)
                  const open = s.status !== 'completed'
                  return (
                    <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', subjectStyle[s.subject])}>
                        <SubjectIcon subject={s.subject} className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.subjects[s.subject]}</span>
                      <span className="text-xs text-muted-foreground tabular">{answeredCount(s)}/{s.items.length}</span>
                      <StateChip state={state} />
                      {open ? (
                        <Button size="sm" variant="outline" className="shrink-0" onClick={() => onOpen(s.id)} aria-label={`${t.daily.continue}: ${t.subjects[s.subject]} ${formatDay(day)}`}>
                          {t.daily.continue}
                        </Button>
                      ) : <span className="w-[5.5rem] shrink-0 max-sm:hidden" />}
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Student daily tasks: today's three subject sets, streaks, past days, and the answering flow. */
export default function DailyPage() {
  const t = useT()
  const today = schoolToday()
  const [params, setParams] = useSearchParams()
  const sets = useMyDailySets()
  const streaks = useMyStreaks()
  const levels = useMyLevels()
  const schoolDay = useIsSchoolDay(today)
  // the set being answered stays open after its last answer completes it (celebration)
  const running = useRef<string | null>(null)

  const openSet = (id: string) => setParams({ set: id })
  const setId = params.get('set')
  const view = params.get('view')
  const todays = (sets.data ?? []).filter((s) => s.set_date === today)
  const past = (sets.data ?? []).filter((s) => s.set_date < today)
  const pastOpen = past.filter((s) => s.status !== 'completed').length

  if (setId) {
    const set = sets.data?.find((s) => s.id === setId)
    if (sets.isPending) return <Skeleton className="mx-auto h-96 max-w-xl rounded-3xl" />
    // unknown, future or already completed (when opened) → back to the hub
    if (!set || (set.status === 'completed' && running.current !== set.id)) return <BackToHub />
    running.current = set.id
    return <SetRunner key={set.id} set={set} today={today} onClose={() => setParams(set.set_date === today ? {} : { view: 'past' })} />
  }

  if (view === 'past') return sets.isPending ? <Skeleton className="mx-auto h-80 max-w-xl" /> : <PastDays sets={past} onOpen={openSet} />

  const allDone = todays.length > 0 && todays.every((s) => s.status === 'completed')
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={t.daily.title} description={t.daily.subtitle} />
      {streaks.isPending ? <Skeleton className="h-44 rounded-3xl" /> : <StreakHero streaks={streaks.data} />}

      <div className="flex items-center justify-between gap-2 pt-1">
        <h2 className="text-base font-semibold">{t.daily.today}</h2>
        <Button asChild variant="ghost" size="sm" className="text-primary">
          <Link to="?view=past">
            <History /> {t.daily.past}
            {pastOpen > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground tabular">{pastOpen}</span>}
            <ChevronRight />
          </Link>
        </Button>
      </div>

      {sets.isError && <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{t.daily.loadError}</p>}
      {allDone && (
        <p className="rounded-2xl bg-success/10 px-4 py-3 text-center text-sm font-semibold text-success" data-testid="all-done">{t.daily.allDone}</p>
      )}

      {sets.isPending || levels.isPending ? <Skeleton className="h-64 rounded-2xl" /> : !schoolDay && todays.length === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border bg-card p-5" data-testid="rest-day">
          <Coffee className="size-8 shrink-0 text-amber-500" />
          <p className="text-sm text-muted-foreground">{t.daily.restDay}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {SUBJECT_ORDER.map((s) => (
            <SubjectCard key={s} subject={s} set={todays.find((x) => x.subject === s)}
              placed={(levels.data ?? []).some((l) => l.subject === s)} onOpen={openSet} />
          ))}
        </ul>
      )}
    </div>
  )
}

/** A stale ?set= (finished, not ours, or gone) quietly returns to the hub. */
function BackToHub() {
  const [, setParams] = useSearchParams()
  useEffect(() => { setParams({}, { replace: true }) }, [setParams])
  return null
}
