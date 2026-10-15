import { useMemo, useState } from 'react'
import { Radio, Trophy } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { CoinAmount } from '@/components/CoinAmount'
import { PageHeader } from '@/components/PageHeader'
import { UserAvatar } from '@/components/UserAvatar'
import { useAuth } from '@/features/auth/AuthProvider'
import { EmptyState } from '@/features/school/components'
import { useClasses, useLeaderboard, useLeaderboardRealtime } from '@/features/school/api'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'
import type { Subject } from '@/types/models'

const MEDALS = ['🥇', '🥈', '🥉']

export default function RatingsPage() {
  const t = useT()
  const { profile } = useAuth()
  const [subject, setSubject] = useState<Subject | null>(null)
  const [classId, setClassId] = useState<string | null>(null)
  const board = useLeaderboard(subject)
  const classes = useClasses()
  useLeaderboardRealtime()

  // With a class filter the class rank is the meaningful number.
  const rows = useMemo(() => {
    const list = (board.data ?? []).filter((r) => !classId || r.class_id === classId)
    return list.map((r) => ({ ...r, rank: classId ? r.class_rank : r.school_rank }))
      .sort((a, b) => a.rank - b.rank || a.full_name.localeCompare(b.full_name))
  }, [board.data, classId])
  const me = rows.find((r) => r.user_id === profile?.id)

  return (
    <>
      <PageHeader
        title={t.ratings.title}
        description={t.ratings.subtitle}
        action={<span className="flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-[11px] font-medium text-success"><Radio className="size-3" /> {t.ratings.live}</span>}
      />

      <div className="mb-3 flex gap-1 overflow-x-auto rounded-xl bg-muted p-1" role="tablist" aria-label={t.ratings.overall}>
        {([null, 'english', 'math', 'it'] as const).map((s) => (
          <button
            key={s ?? 'all'} role="tab" aria-selected={subject === s} onClick={() => setSubject(s)}
            className={cn('flex-1 rounded-lg px-2.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
              subject === s ? 'bg-card shadow-xs' : 'text-muted-foreground hover:text-foreground')}
          >
            {s ? t.subjects[s] : t.ratings.overall}
          </button>
        ))}
      </div>

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0" aria-label={t.profile.class}>
        {[{ id: null, name: t.ratings.allClasses }, ...(classes.data ?? [])].map((c) => (
          <button
            key={c.id ?? 'all'} onClick={() => setClassId(c.id)} aria-pressed={classId === c.id}
            className={cn('shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
              classId === c.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-secondary')}
          >
            {c.name}
          </button>
        ))}
      </div>

      {me && (
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-primary p-3 text-primary-foreground" data-testid="my-rank">
          <span className="grid size-10 place-items-center rounded-full bg-white/15 text-lg font-bold tabular">#{me.rank}</span>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-primary-foreground/90">{t.ratings.you}</div>
            <div className="truncate font-semibold">{me.full_name}</div>
          </div>
          <CoinAmount value={me.points} className="text-lg" />
        </div>
      )}

      {board.isPending ? <Skeleton className="h-96 w-full" /> : rows.length === 0 ? (
        <EmptyState icon={Trophy} text={t.ratings.empty} className="rounded-xl border bg-card" />
      ) : (
        <ol className="divide-y overflow-hidden rounded-xl border bg-card" data-testid="leaderboard">
          {rows.map((r) => {
            const mine = r.user_id === profile?.id
            return (
              <li
                key={r.user_id}
                aria-current={mine ? 'true' : undefined}
                className={cn('flex items-center gap-3 px-3 py-2.5 sm:px-4', mine && 'bg-primary-soft ring-2 ring-primary ring-inset')}
              >
                <span className="w-8 shrink-0 text-center font-bold tabular">
                  {r.rank <= 3 ? <span className="text-2xl leading-none" aria-label={`${r.rank}`}>{MEDALS[r.rank - 1]}</span> : r.rank}
                </span>
                <UserAvatar name={r.full_name} url={r.avatar_url} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{r.full_name}{mine && <span className="ml-1.5 text-xs font-semibold text-primary">({t.ratings.you})</span>}</div>
                  <div className="text-xs text-muted-foreground">{r.class_name ?? '—'}</div>
                </div>
                <CoinAmount value={r.points} className="text-sm" />
              </li>
            )
          })}
        </ol>
      )}
    </>
  )
}
