import { Info, Trophy } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/PageHeader'
import { useSelectedChild } from '@/components/layout/ParentLayout'
import { SUBJECT_ORDER } from '@/features/daily/api'
import { SubjectIcon } from '@/features/daily/components'
import { useChildRank, useChildSubjectRanks } from '@/features/parent/api'
import { EmptyState, SectionCard, subjectStyle } from '@/features/school/components'
import { cn } from '@/lib/utils'
import { fmt, useT } from '@/i18n'

/** The child's leaderboard position: overall (school + class) and per subject. */
export default function ParentRatingPage() {
  const t = useT()
  const child = useSelectedChild()
  const rank = useChildRank(child.id)
  const subjects = useChildSubjectRanks(child.id)

  return (
    <div className="space-y-4">
      <PageHeader title={t.parent.ratingTitle} description={child.full_name} />

      {rank.isPending ? <Skeleton className="h-36 rounded-3xl" /> : !rank.data ? (
        <div className="rounded-2xl border bg-card"><EmptyState icon={Trophy} text={t.parent.noRank} /></div>
      ) : (
        <div className="rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-500 p-5 text-white shadow-md" data-testid="rating-hero">
          <div className="flex items-center gap-1.5 text-sm font-medium text-white/90"><Trophy className="size-4" /> {t.parent.overallRank}</div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-black/10 p-3">
              <div className="text-xs text-white/90">{t.parent.schoolRank}</div>
              <div className="text-3xl font-extrabold tabular">#{rank.data.school_rank}</div>
            </div>
            <div className="rounded-2xl bg-black/10 p-3">
              <div className="truncate text-xs text-white/90">{t.parent.classRank}{rank.data.class_name ? ` · ${rank.data.class_name}` : ''}</div>
              <div className="text-3xl font-extrabold tabular">#{rank.data.class_rank}</div>
            </div>
          </div>
          <div className="mt-3 text-sm font-semibold tabular">{fmt(t.parent.points, { n: rank.data.points })}</div>
        </div>
      )}

      <SectionCard title={t.parent.bySubject} className="rounded-2xl">
        {subjects.isPending ? <Skeleton className="m-4 h-32" /> : (
          <ul className="divide-y" data-testid="subject-ranks">
            {SUBJECT_ORDER.map((subj) => {
              const r = subjects.data?.find((x) => x.subject === subj)
              return (
                <li key={subj} className="flex items-center gap-3 px-4 py-3">
                  <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', subjectStyle[subj])}>
                    <SubjectIcon subject={subj} className="size-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{t.subjects[subj]}</div>
                    <div className="text-xs text-muted-foreground tabular">{r ? fmt(t.parent.points, { n: r.points }) : '—'}</div>
                  </div>
                  {r && (
                    <div className="text-right tabular">
                      <div className="text-sm font-bold">#{r.school_rank}</div>
                      <div className="text-[11px] text-muted-foreground">{t.parent.classRank}: #{r.class_rank}</div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </SectionCard>

      <p className="flex gap-2 px-1 text-xs text-muted-foreground"><Info className="mt-0.5 size-3.5 shrink-0" /> {t.parent.rankHint}</p>
    </div>
  )
}
