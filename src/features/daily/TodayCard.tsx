import { Link } from 'react-router-dom'
import { ChevronRight, CircleCheck, Flame } from 'lucide-react'
import { schoolToday } from '@/features/school/api'
import { subjectStyle } from '@/features/school/components'
import { cn } from '@/lib/utils'
import { fmt, useT } from '@/i18n'
import { SUBJECT_ORDER, useMyDailySets, useMyStreaks } from './api'
import { SubjectIcon, answeredCount } from './components'

/** Home: today's daily-task progress per subject + the overall streak, linking to /daily. */
export function TodayCard() {
  const t = useT()
  const today = schoolToday()
  const sets = useMyDailySets()
  const streaks = useMyStreaks()
  const todays = (sets.data ?? []).filter((s) => s.set_date === today)
  const done = todays.filter((s) => s.status === 'completed').length
  const overall = streaks.data?.find((s) => s.subject === null)?.current_streak ?? 0

  return (
    <Link to="/daily" className="group block rounded-2xl border bg-card p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-sm" data-testid="today-card">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 text-white">
          <Flame className="size-5" fill={overall > 0 ? 'currentColor' : 'none'} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{t.daily.homeCard}</div>
          <div className="text-xs text-muted-foreground">
            {todays.length ? fmt(t.daily.homeCardDone, { done, total: todays.length }) : t.daily.homeCardNone}
            {' · '}{t.daily.streak}: {fmt(t.daily.streakDays, { n: overall })}
          </div>
        </div>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      {todays.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {SUBJECT_ORDER.map((subj) => {
            const s = todays.find((x) => x.subject === subj)
            return (
              <div key={subj} className={cn('flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-medium', s ? subjectStyle[subj] : 'bg-muted text-muted-foreground')}>
                <SubjectIcon subject={subj} className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{t.subjects[subj]}</span>
                {s && (s.status === 'completed' ? <CircleCheck className="size-3.5 shrink-0" /> : <span className="tabular">{answeredCount(s)}/{s.items.length}</span>)}
              </div>
            )
          })}
        </div>
      )}
    </Link>
  )
}
