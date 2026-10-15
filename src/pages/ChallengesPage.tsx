import { useMemo, useState } from 'react'
import { CircleCheck, CircleCheckBig, CircleX, Flame, Hourglass, ListChecks, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { CoinAmount } from '@/components/CoinAmount'
import { PageHeader } from '@/components/PageHeader'
import { useAuth } from '@/features/auth/AuthProvider'
import { FormDialog } from '@/features/manage/dialogs'
import { schoolToday, useChallenges, useMySubmissions, useSubmitChallenge } from '@/features/school/api'
import { EmptyState, subjectStyle } from '@/features/school/components'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'
import type { Challenge, Subject, Submission } from '@/types/models'

/** Consecutive school days (Sundays skipped) with an approved non-streak submission, ending today or yesterday. */
function streakCount(days: Set<string>, today: string) {
  const d = new Date(today + 'T00:00:00Z')
  if (!days.has(today)) d.setUTCDate(d.getUTCDate() - 1)   // today not done yet doesn't break the streak
  let n = 0
  for (let guard = 0; guard < 60; guard++) {
    const iso = d.toISOString().slice(0, 10)
    if (d.getUTCDay() !== 0) {
      if (!days.has(iso)) break
      n++
    }
    d.setUTCDate(d.getUTCDate() - 1)
  }
  return n
}

function QuizDialog({ challenge, onClose }: { challenge: Challenge; onClose: () => void }) {
  const t = useT()
  const submit = useSubmitChallenge()
  const questions = challenge.content.questions ?? []
  const [answers, setAnswers] = useState<Record<string, number>>({})
  return (
    <FormDialog
      open onOpenChange={(o) => !o && onClose()} title={challenge.title}
      description={`${t.challenges.passScore}: ${challenge.pass_score}%`} submitLabel={t.challenges.submit}
      canSubmit={Object.keys(answers).length === questions.length}
      onSubmit={async () => {
        const r = await submit.mutateAsync({ challengeId: challenge.id, quizAnswers: answers })
        const score = Math.round(Number(r.score ?? 0))
        if (r.status === 'approved') toast.success(`${t.challenges.passed} — ${score}%`, { description: `+${r.coins_awarded} coin` })
        else toast.error(`${t.challenges.failed} — ${score}%`, { description: t.challenges.tryTomorrow })
      }}
    >
      <ol className="space-y-4">
        {questions.map((q, qi) => (
          <li key={q.id}>
            <p className="mb-2 text-sm font-medium">{qi + 1}. {q.text}</p>
            <div className="grid gap-1.5" role="radiogroup">
              {q.options.map((opt, oi) => (
                <label
                  key={oi}
                  className={cn('flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors',
                    answers[q.id] === oi ? 'border-primary bg-primary-soft' : 'hover:bg-muted')}
                >
                  <input type="radio" name={q.id} className="accent-primary" checked={answers[q.id] === oi} onChange={() => setAnswers({ ...answers, [q.id]: oi })} />
                  {opt}
                </label>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </FormDialog>
  )
}

function TaskDialog({ challenge, onClose }: { challenge: Challenge; onClose: () => void }) {
  const t = useT()
  const submit = useSubmitChallenge()
  const [answer, setAnswer] = useState('')
  return (
    <FormDialog
      open onOpenChange={(o) => !o && onClose()} title={challenge.title} description={challenge.description}
      submitLabel={t.challenges.submit} canSubmit={!!answer.trim()}
      onSubmit={async () => { await submit.mutateAsync({ challengeId: challenge.id, answer: answer.trim() }); toast.success(t.challenges.taskSent) }}
    >
      <Textarea rows={5} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={t.challenges.answerPlaceholder} aria-label={t.challenges.answerPlaceholder} autoFocus />
    </FormDialog>
  )
}

function StatusChip({ s }: { s: Submission }) {
  const t = useT()
  const map = {
    approved: ['bg-success/10 text-success', CircleCheck, t.challenges.approved],
    submitted: ['bg-warning/15 text-amber-700 dark:text-amber-300', Hourglass, t.challenges.submitted],
    rejected: ['bg-destructive/10 text-destructive', CircleX, t.challenges.rejected],
  } as const
  const [cls, Icon, label] = map[s.status]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', cls)}>
      <Icon className="size-3.5" /> {label}{s.score != null && s.status !== 'submitted' ? ` · ${Math.round(Number(s.score))}%` : ''}
    </span>
  )
}

export default function ChallengesPage() {
  const t = useT()
  const { profile } = useAuth()
  const isStudent = profile?.role === 'student'
  const [subject, setSubject] = useState<Subject>('english')
  const [open, setOpen] = useState<Challenge | null>(null)
  const challenges = useChallenges()
  const subs = useMySubmissions()
  const today = schoolToday()

  const byChallenge = useMemo(() => {
    const m = new Map<string, Submission[]>()
    for (const s of subs.data ?? []) m.set(s.challenge_id, [...(m.get(s.challenge_id) ?? []), s])
    return m
  }, [subs.data])
  const approvedDays = useMemo(() => {
    const subjectOf = new Map((challenges.data ?? []).map((c) => [c.id, c]))
    const days = new Set<string>()
    for (const s of subs.data ?? []) {
      const c = subjectOf.get(s.challenge_id)
      if (c && c.subject === subject && c.type !== 'streak' && s.status === 'approved') days.add(s.submitted_on)
    }
    return days
  }, [subs.data, challenges.data, subject])
  const list = (challenges.data ?? []).filter((c) => c.subject === subject)

  return (
    <>
      <PageHeader title={t.challenges.title} description={t.challenges.subtitle} />
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1" role="tablist">
        {(['english', 'math', 'it'] as const).map((s) => (
          <button key={s} role="tab" aria-selected={subject === s} onClick={() => setSubject(s)}
            className={cn('rounded-lg px-2 py-2 text-sm font-medium transition-colors', subject === s ? 'bg-card shadow-xs' : 'text-muted-foreground hover:text-foreground')}>
            {t.subjects[s]}
          </button>
        ))}
      </div>

      {challenges.isPending || subs.isPending ? <Skeleton className="h-80 w-full" /> : list.length === 0 ? (
        <EmptyState icon={ListChecks} text={t.challenges.empty} className="rounded-xl border bg-card" />
      ) : (
        <ul className="space-y-3" data-testid="challenges">
          {list.map((c) => {
            const mine = byChallenge.get(c.id) ?? []
            const todays = mine.find((s) => s.submitted_on === today)
            const latest = mine[0]
            const blockedOnce = c.recurrence === 'once' && mine.some((s) => s.status !== 'rejected')
            const done = c.type !== 'streak' && (todays || blockedOnce)
            const streak = c.type === 'streak' ? streakCount(approvedDays, today) : 0
            return (
              <li key={c.id} className="rounded-xl border bg-card p-4" data-testid="challenge">
                <div className="flex items-start gap-3">
                  <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl', subjectStyle[c.subject])}>
                    {c.type === 'streak' ? <Flame className="size-5" /> : c.type === 'quiz' ? <CircleCheckBig className="size-5" /> : <Send className="size-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase">
                      <span>{t.challenges[c.type]}</span>·<span>{c.recurrence === 'daily' ? t.challenges.daily : t.challenges.once}</span>
                    </div>
                    <h3 className="font-semibold">{c.title}</h3>
                    <p className="text-sm text-muted-foreground">{c.description}</p>
                    {c.type === 'streak' && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{Math.min(streak, c.streak_days ?? 0)} / {c.streak_days} {t.challenges.streakHint}</span>
                        </div>
                        <Progress value={Math.min(100, (streak / (c.streak_days ?? 1)) * 100)} className="mt-1 h-1.5" />
                        <p className="mt-1 text-xs text-muted-foreground">{t.challenges.streakAuto}</p>
                      </div>
                    )}
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-1 text-sm"><span className="text-muted-foreground">{t.challenges.reward}:</span> <CoinAmount value={c.coins_reward} /></span>
                      {(todays ?? (blockedOnce ? latest : undefined)) && <StatusChip s={(todays ?? latest)!} />}
                      {isStudent && c.type !== 'streak' && !done && (
                        <Button size="sm" onClick={() => setOpen(c)}>{c.type === 'quiz' ? t.challenges.start : t.challenges.submit}</Button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {open?.type === 'quiz' && <QuizDialog challenge={open} onClose={() => setOpen(null)} />}
      {open?.type === 'task' && <TaskDialog challenge={open} onClose={() => setOpen(null)} />}
    </>
  )
}
