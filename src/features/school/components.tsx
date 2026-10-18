import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, ChevronRight, type LucideIcon } from 'lucide-react'
import { cn, formatCoins, formatDate } from '@/lib/utils'
import { fmt, useT } from '@/i18n'
import type { HistoryRow } from './txGroups'

export function SectionCard({
  title, to, action, children, className,
}: { title: string; to?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  const t = useT()
  return (
    <section className={cn('rounded-xl border bg-card', className)}>
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action ?? (to && (
          <Link to={to} className="flex items-center gap-0.5 text-xs font-medium text-primary hover:underline">
            {t.home.seeAll} <ChevronRight className="size-3.5" />
          </Link>
        ))}
      </div>
      {children}
    </section>
  )
}

export function EmptyState({ icon: Icon, text, className }: { icon: LucideIcon; text: string; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-2 px-4 py-10 text-center', className)}>
      <Icon className="size-8 text-muted-foreground/60" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}

/** One ledger row: arrow, reason, category · subject · date, signed amount. */
export function TxRow({ tx }: { tx: HistoryRow }) {
  const t = useT()
  const earn = tx.direction === 'earn'
  // a day's daily-task coins for one subject, collapsed (groupDailyTx)
  const daily = tx.daily
  const dailyNote = daily && (daily.score ? fmt(t.daily.historyScore, { s: daily.score })
    : daily.correct > 0 ? fmt(t.daily.historyCorrect, { n: daily.correct }) : null)
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <span className={cn('grid size-8 shrink-0 place-items-center rounded-full', earn ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive')}>
        {earn ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{daily ? t.daily.historyTitle : tx.reason || t.categories[tx.category]}</div>
        <div className="truncate text-xs text-muted-foreground">
          {daily
            ? `${tx.subject ? t.subjects[tx.subject] : ''} · ${formatDate(tx.created_at)}${dailyNote ? ` · ${dailyNote}` : ''}`
            : `${t.categories[tx.category]}${tx.subject ? ` · ${t.subjects[tx.subject]}` : ''} · ${formatDate(tx.created_at)}`}
        </div>
      </div>
      <span className={cn('shrink-0 text-sm font-semibold tabular', earn ? 'text-success' : 'text-destructive')}>
        {earn ? '+' : '−'}{formatCoins(tx.amount)}
      </span>
    </li>
  )
}

/** Whole days from school-local today to `date` (YYYY-MM-DD): +3 = in 3 days, −2 = 2 days ago. */
export function daysFrom(date: string, today: string) {
  const day = (d: string) => Date.parse(d.slice(0, 10) + 'T00:00:00Z')   // tolerate timestamp-shaped dates
  return Math.round((day(date) - day(today)) / 86_400_000)
}

export const subjectStyle: Record<string, string> = {
  english: 'bg-subject-english/10 text-subject-english',
  math: 'bg-subject-math/10 text-subject-math',
  it: 'bg-subject-it/10 text-subject-it',
}
