import { CircleCheck, Coffee, Flame, Trophy } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { SUBJECT_ORDER, useIsSchoolDay } from '@/features/daily/api'
import { StateChip, SubjectIcon, answeredCount, setState } from '@/features/daily/components'
import { schoolToday } from '@/features/school/api'
import { subjectStyle } from '@/features/school/components'
import { cn } from '@/lib/utils'
import { fmt, useT } from '@/i18n'
import { useChildDailySets, useChildLevels, useChildRank, useChildStreaks } from './api'

/** Today's three subjects for one child: done / in progress / not started / not placed. */
export function TodayStatus({ childId }: { childId: string }) {
  const t = useT()
  const today = schoolToday()
  const sets = useChildDailySets(childId)
  const levels = useChildLevels(childId)
  const schoolDay = useIsSchoolDay(today)
  const todays = (sets.data ?? []).filter((s) => s.set_date === today)
  const done = todays.filter((s) => s.status === 'completed').length

  if (sets.isPending || levels.isPending) return <Skeleton className="m-4 h-32" />
  if (sets.isError) return <p className="px-4 py-6 text-center text-sm text-destructive">{sets.error.message}</p>

  return (
    <div data-testid="today-status">
      <div className="flex items-center gap-2 px-4 pt-3 text-sm font-medium">
        {todays.length > 0 && done === todays.length ? (
          <span className="flex items-center gap-1.5 text-success"><CircleCheck className="size-4" /> {t.parent.todayAllDone}</span>
        ) : todays.length > 0 ? (
          <span className="text-muted-foreground tabular">{fmt(t.parent.todayDone, { done, total: todays.length })}</span>
        ) : !schoolDay ? (
          <span className="flex items-center gap-1.5 text-muted-foreground"><Coffee className="size-4 text-amber-500" /> {t.parent.restDay}</span>
        ) : (
          <span className="text-muted-foreground">{t.parent.todayNone}</span>
        )}
      </div>
      <ul className="divide-y">
        {SUBJECT_ORDER.map((subj) => {
          const s = todays.find((x) => x.subject === subj)
          const level = levels.data?.find((l) => l.subject === subj)
          return (
            <li key={subj} className="flex items-center gap-3 px-4 py-2.5" data-testid={`today-${subj}`}>
              <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', subjectStyle[subj])}>
                <SubjectIcon subject={subj} className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{t.subjects[subj]}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {level ? level.levels?.name ?? '' : t.parent.notPlaced}
                  {level && !s && schoolDay ? ` · ${t.parent.noPool}` : ''}
                </div>
              </div>
              {s && <span className="text-xs text-muted-foreground tabular">{answeredCount(s)}/{s.items.length}</span>}
              {s && <StateChip state={setState(s)} today />}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Overall streak + school/class rank side by side. */
export function StreakAndRank({ childId }: { childId: string }) {
  const t = useT()
  const streaks = useChildStreaks(childId)
  const rank = useChildRank(childId)
  const n = streaks.data?.find((s) => s.subject === null)?.current_streak ?? 0

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 p-4 text-white" data-testid="parent-streak">
        <div className="flex items-center gap-1.5 text-xs font-medium text-white/90"><Flame className="size-3.5" fill={n > 0 ? 'currentColor' : 'none'} /> {t.parent.streak}</div>
        {streaks.isPending ? <Skeleton className="mt-2 h-8 w-16 bg-white/30" /> : (
          <div className="mt-1 text-2xl font-extrabold tabular">{fmt(t.daily.streakDays, { n })}</div>
        )}
      </div>
      <div className="rounded-2xl border bg-card p-4" data-testid="parent-rank">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Trophy className="size-3.5" /> {t.parent.schoolRank}</div>
        {rank.isPending ? <Skeleton className="mt-2 h-8 w-16" /> : (
          <div className="mt-1 text-2xl font-bold tabular">{rank.data ? `#${rank.data.school_rank}` : '—'}</div>
        )}
        {rank.data && (
          <div className="truncate text-xs text-muted-foreground tabular">
            {t.parent.classRank}{rank.data.class_name ? ` (${rank.data.class_name})` : ''}: #{rank.data.class_rank}
          </div>
        )}
      </div>
    </div>
  )
}
