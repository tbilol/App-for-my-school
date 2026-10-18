import { useMemo } from 'react'
import { CalendarClock, CalendarX } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/PageHeader'
import { useSelectedChild } from '@/components/layout/ParentLayout'
import { SUBJECT_ORDER, formatDay, type DailySetWithProgress } from '@/features/daily/api'
import { StateChip, StreakHero, SubjectIcon, answeredCount, setState } from '@/features/daily/components'
import { useChildDailySets, useChildStreaks } from '@/features/parent/api'
import { TodayStatus } from '@/features/parent/components'
import { schoolToday } from '@/features/school/api'
import { EmptyState, SectionCard, subjectStyle } from '@/features/school/components'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'

/** Read-only view of the child's daily tasks: streaks, today, and recent days per subject. */
export default function ParentDailyPage() {
  const t = useT()
  const child = useSelectedChild()
  const today = schoolToday()
  const sets = useChildDailySets(child.id)
  const streaks = useChildStreaks(child.id)

  const byDay = useMemo(() => {
    const m = new Map<string, DailySetWithProgress[]>()
    for (const s of sets.data ?? []) if (s.set_date < today) m.set(s.set_date, [...(m.get(s.set_date) ?? []), s])
    return [...m.entries()].map(([day, list]) => [day, list.sort((a, b) => SUBJECT_ORDER.indexOf(a.subject) - SUBJECT_ORDER.indexOf(b.subject))] as const)
  }, [sets.data, today])

  return (
    <div className="space-y-4">
      <PageHeader title={t.parent.dailyTitle} description={t.parent.dailyHint} />
      {streaks.isPending ? <Skeleton className="h-44 rounded-3xl" /> : (
        <StreakHero streaks={streaks.data} hints={{ active: t.parent.streakActive, zero: t.parent.streakZero }} />
      )}

      <SectionCard title={t.parent.today} className="rounded-2xl">
        <TodayStatus childId={child.id} />
      </SectionCard>

      <SectionCard title={t.parent.recentDays} className="rounded-2xl">
        {sets.isPending ? <Skeleton className="m-4 h-40" /> : !byDay.length ? <EmptyState icon={CalendarX} text={t.parent.noDays} /> : (
          <ul className="divide-y" data-testid="parent-days">
            {byDay.map(([day, list]) => (
              <li key={day}>
                <div className="flex items-center gap-2 bg-muted/50 px-4 py-2 text-sm">
                  <CalendarClock className="size-4 text-muted-foreground" />
                  <span className="font-semibold">{t.daily.weekdays[new Date(day + 'T00:00:00Z').getUTCDay()]}</span>
                  <span className="text-muted-foreground tabular">{formatDay(day)}</span>
                </div>
                <ul className="divide-y">
                  {list.map((s) => (
                    <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', subjectStyle[s.subject])}>
                        <SubjectIcon subject={s.subject} className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.subjects[s.subject]}</span>
                      <span className="text-xs text-muted-foreground tabular">{answeredCount(s)}/{s.items.length}</span>
                      <StateChip state={setState(s)} />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}
