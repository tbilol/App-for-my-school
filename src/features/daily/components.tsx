import { Calculator, Flame, Languages, Laptop } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmt, useT } from '@/i18n'
import type { StudentStreak, Subject } from '@/types/models'
import { SUBJECT_ORDER, type DailySetWithProgress } from './api'

const ICONS = { english: Languages, math: Calculator, it: Laptop } as const

export function SubjectIcon({ subject, className }: { subject: Subject; className?: string }) {
  const Icon = ICONS[subject]
  return <Icon className={className} />
}

export type SetState = 'done' | 'late' | 'partial' | 'todo'

export function setState(s: DailySetWithProgress): SetState {
  if (s.status === 'completed') return s.on_time ? 'done' : 'late'
  return s.items.some((i) => i.status !== 'pending') ? 'partial' : 'todo'
}

export function answeredCount(s: DailySetWithProgress) {
  return s.items.filter((i) => i.status !== 'pending').length
}

const STATE_STYLE: Record<SetState, string> = {
  done: 'bg-success/10 text-success',
  late: 'bg-success/10 text-success',
  partial: 'bg-warning/15 text-amber-700 dark:text-amber-300',
  todo: 'bg-destructive/10 text-destructive',
}

/** Status pill for one set. `today`: an unfinished set is still in progress, not missed. */
export function StateChip({ state, today }: { state: SetState; today?: boolean }) {
  const t = useT()
  const label = today && state === 'todo' ? t.daily.statusNotStarted
    : today && state === 'partial' ? t.daily.statusInProgress
    : { done: t.daily.statusDone, late: t.daily.statusLate, partial: t.daily.statusPartial, todo: t.daily.statusMissed }[state]
  const style = today && state === 'todo' ? 'bg-muted text-muted-foreground' : STATE_STYLE[state]
  return <span className={cn('inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium', style)}>{label}</span>
}

/** Overall streak (big) + one small flame per subject. `hints` replaces the student-facing captions. */
export function StreakHero({ streaks, hints }: { streaks: StudentStreak[] | undefined; hints?: { active: string; zero: string } }) {
  const t = useT()
  const overall = streaks?.find((s) => s.subject === null)
  const n = overall?.current_streak ?? 0
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-orange-500 to-amber-400 p-5 text-white shadow-md sm:p-6" data-testid="streak-hero">
      <div aria-hidden className="pointer-events-none absolute -top-14 -right-10 size-44 rounded-full bg-white/10" />
      <div aria-hidden className="pointer-events-none absolute -bottom-16 -left-8 size-36 rounded-full bg-white/10" />
      <div className="relative flex items-center gap-4">
        <span className={cn('grid size-16 shrink-0 place-items-center rounded-2xl bg-white/20 backdrop-blur-sm', n > 0 && 'motion-safe:animate-pulse')}>
          <Flame className="size-9" fill={n > 0 ? 'currentColor' : 'none'} />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-medium text-white/90">{t.daily.streakOverall}</div>
          <div className="text-4xl leading-tight font-extrabold tabular" data-testid="overall-streak">{fmt(t.daily.streakDays, { n })}</div>
          <div className="text-xs text-white/90">
            {n > 0 ? (hints?.active ?? t.daily.streakOverallHint) : (hints?.zero ?? t.daily.streakZero)}
            {(overall?.longest_streak ?? 0) > 0 && <> · {fmt(t.daily.streakBest, { n: overall!.longest_streak })}</>}
          </div>
        </div>
      </div>
      <div className="relative mt-4 grid grid-cols-3 gap-2">
        {SUBJECT_ORDER.map((s) => {
          const c = streaks?.find((x) => x.subject === s)?.current_streak ?? 0
          return (
            <div key={s} className="flex items-center justify-center gap-2 rounded-2xl bg-black/10 px-2.5 py-2 sm:justify-start" data-testid={`streak-${s}`} title={t.subjects[s]}>
              <SubjectIcon subject={s} className="size-4 shrink-0 text-white/90" />
              <span className="min-w-0 flex-1 truncate text-xs text-white/90 max-sm:sr-only">{t.subjects[s]}</span>
              <span className="flex shrink-0 items-center gap-0.5 text-sm font-bold tabular">
                <Flame className={cn('size-3.5', c === 0 && 'opacity-60')} fill={c > 0 ? 'currentColor' : 'none'} />{c}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
