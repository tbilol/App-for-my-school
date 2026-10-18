import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  ArrowRight, CircleCheck, CircleX, Flame, Hourglass, Loader2, PartyPopper, Send, Timer, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { CoinIcon } from '@/components/CoinAmount'
import { subjectStyle } from '@/features/school/components'
import { errorMessage } from '@/lib/errors'
import { cn, formatCoins } from '@/lib/utils'
import { fmt, useT } from '@/i18n'
import type { DailyItem, DailySubmitResult } from '@/types/models'
import { formatDay, useDailyItems, useMyStreaks, useSubmitDailyItem, type DailySetWithProgress } from './api'
import { SubjectIcon } from './components'

/** Human-readable correct answer from the revealed key. */
function correctText(item: DailyItem, key: DailySubmitResult['correct_answer']) {
  if (!key) return null
  if (item.answer_mode === 'choice') {
    const list = Array.isArray(key.correct) ? key.correct : key.correct != null ? [key.correct] : []
    return list.map((i) => item.body.options?.[i] ?? '').join(', ')
  }
  return (key.values ?? (key.value != null ? [key.value] : [])).join(' / ')
}
function isCorrectOption(key: DailySubmitResult['correct_answer'], i: number) {
  const c = key?.correct
  return Array.isArray(c) ? c.includes(i) : c === i
}

function useStopwatch(running: boolean) {
  const start = useRef(Date.now())
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setSecs(Math.floor((Date.now() - start.current) / 1000)), 1000)
    return () => clearInterval(id)
  }, [running])
  return `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
}

/** Falling paper pieces; hidden for prefers-reduced-motion (see index.css). */
function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
    dx: Math.round((Math.random() - 0.5) * 320), rot: Math.round(Math.random() * 720 - 360),
    delay: Math.random() * 0.35, dur: 1.4 + Math.random() * 0.9,
    color: ['#f59e0b', '#2563eb', '#7c3aed', '#0891b2', '#16a34a', '#ef4444'][i % 6], w: 6 + (i % 3) * 2,
  })), [])
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-6 flex justify-center">
      {pieces.map((p, i) => (
        <span
          key={i} className="zs-confetti absolute block rounded-[2px]"
          style={{
            width: p.w, height: p.w * 1.6, background: p.color,
            ['--dx' as string]: `${p.dx}px`, ['--rot' as string]: `${p.rot}deg`,
            animation: `zs-confetti ${p.dur}s cubic-bezier(.2,.6,.4,1) ${p.delay}s both`,
          }}
        />
      ))}
    </div>
  )
}

function Celebration({ set, result, today, hasWriting, onDone }: {
  set: DailySetWithProgress; result: DailySubmitResult; today: string; hasWriting: boolean; onDone: () => void
}) {
  const t = useT()
  const streaks = useMyStreaks()
  const subjectStreak = streaks.data?.find((s) => s.subject === set.subject)?.current_streak
  const subject = t.subjects[set.subject]
  const onTime = !!result.set_on_time
  return (
    <div className="relative mx-auto max-w-md overflow-hidden rounded-3xl border bg-card px-6 pt-10 pb-6 text-center shadow-sm" data-testid="celebration">
      <Confetti />
      <div className="relative mx-auto grid size-20 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-500">
        <PartyPopper className="size-9" />
      </div>
      <h2 className="mt-5 text-2xl font-bold tracking-tight">{t.daily.celebrateTitle}</h2>
      <p className="mt-1 text-muted-foreground">
        {set.set_date === today ? fmt(t.daily.celebrateBody, { subject }) : fmt(t.daily.celebrateLate, { subject, date: formatDay(set.set_date) })}
      </p>
      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-amber-50 p-3 dark:bg-amber-500/10">
          <div className="text-xs text-muted-foreground">{t.daily.setCoins}</div>
          <div className="mt-1 flex items-center justify-center gap-1 text-xl font-bold whitespace-nowrap text-amber-600 tabular sm:text-2xl dark:text-amber-400" data-testid="set-total">
            <CoinIcon className="size-6" /> {fmt(t.daily.setTotal, { n: formatCoins(result.set_coins) })}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground tabular" data-testid="set-breakdown">
            {fmt(t.daily.breakdown, { c: result.set_correct, total: result.set_total })}
            {result.set_bonus > 0 && <> · {fmt(t.daily.breakdownBonus, { n: result.set_bonus })}</>}
          </div>
        </div>
        <div className="rounded-2xl bg-orange-50 p-3 dark:bg-orange-500/10">
          <div className="text-xs text-muted-foreground">{t.daily.streak}</div>
          <div className="mt-1 flex items-center justify-center gap-1 text-2xl font-bold tabular text-orange-600 dark:text-orange-400">
            <Flame className="size-6" /> {subjectStreak ?? '…'}
          </div>
        </div>
      </div>
      {!onTime && <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{t.daily.lateNoStreak}</p>}
      {hasWriting && <p className="mt-3 text-xs text-muted-foreground">{t.daily.writingPending}</p>}
      <Button className="mt-6 h-11 w-full" onClick={onDone}>{t.daily.backToHub}</Button>
    </div>
  )
}

/**
 * One subject set, one question at a time. Starts at the first unanswered
 * item; answered items are locked. Completion (bonus + streak) happens on the
 * server with the last answer, then a celebration shows.
 */
export function SetRunner({ set, today, onClose }: { set: DailySetWithProgress; today: string; onClose: () => void }) {
  const t = useT()
  const items = useDailyItems(set.id)
  const submit = useSubmitDailyItem()
  const [idx, setIdx] = useState<number | null>(null)
  const [choice, setChoice] = useState<number | null>(null)
  const [value, setValue] = useState('')
  const [text, setText] = useState('')
  const [result, setResult] = useState<DailySubmitResult | null>(null)
  const [finished, setFinished] = useState<DailySubmitResult | null>(null)
  const timer = useStopwatch(set.subject === 'math' && !finished)

  const list = items.data ?? []
  // start at the first pending item once loaded
  useEffect(() => {
    if (idx === null && items.data) setIdx(Math.max(0, items.data.findIndex((i) => i.status === 'pending')))
  }, [items.data, idx])

  const item = idx !== null ? list[idx] : undefined
  const answered = list.filter((i) => i.status !== 'pending').length
  // visual only: what the answers so far are worth — credited once, when the set completes
  const tally = list.reduce((n, i) => n + (i.status !== 'pending' && i.answer_mode !== 'text' ? i.coins_awarded : 0), 0)

  function resetDraft() { setChoice(null); setValue(''); setText(''); setResult(null) }

  function goNext() {
    if (result?.set_status === 'completed') { setFinished(result); return }
    const next = list.findIndex((i, j) => j > (idx ?? -1) && i.status === 'pending')
    const wrap = next >= 0 ? next : list.findIndex((i) => i.status === 'pending')
    resetDraft()
    if (wrap >= 0) setIdx(wrap)
    else onClose()
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!item || result) return
    const answer = item.answer_mode === 'choice' ? { choice: choice! } : item.answer_mode === 'exact' ? { value: value.trim() } : { text: text.trim() }
    try {
      setResult(await submit.mutateAsync({ itemId: item.id, answer }))
    } catch (err) {
      toast.error(errorMessage(err))
      if (err instanceof Error && err.message === 'already_answered') { await items.refetch(); goNext() }
    }
  }

  if (finished) {
    return <Celebration set={set} result={finished} today={today} hasWriting={list.some((i) => i.answer_mode === 'text')} onDone={onClose} />
  }
  if (items.isPending || idx === null) return <Skeleton className="mx-auto h-96 max-w-xl rounded-3xl" />
  if (!item) return null

  const locked = !!result || item.status !== 'pending'
  const canSubmit = !locked && !submit.isPending && (
    item.answer_mode === 'choice' ? choice !== null : item.answer_mode === 'exact' ? !!value.trim() : !!text.trim())
  const shownChoice = result?.student_answer && 'choice' in result.student_answer ? result.student_answer.choice : choice
  const isLast = list.filter((i) => i.status === 'pending' && i.id !== item.id).length === 0
  const passage = typeof item.body.passage === 'string' ? item.body.passage : null
  const note = typeof item.body.note === 'string' ? item.body.note : null

  return (
    <div className="mx-auto max-w-xl" data-testid="set-runner">
      {/* header: subject, progress, timer, close */}
      <div className="mb-4 flex items-center gap-3">
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', subjectStyle[set.subject])}>
          <SubjectIcon subject={set.subject} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate font-semibold">
              {t.subjects[set.subject]}{set.set_date !== today && <span className="font-normal text-muted-foreground"> · {formatDay(set.set_date)}</span>}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground tabular">{fmt(t.daily.question, { n: idx + 1, total: list.length })}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <Progress value={(answered / Math.max(list.length, 1)) * 100} className="h-2 flex-1" aria-label={fmt(t.daily.progress, { done: answered, total: list.length })} />
            {tally > 0 && (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-1.5 text-[11px] leading-5 font-semibold text-amber-700 tabular dark:bg-amber-500/15 dark:text-amber-300"
                title={t.daily.tallyHint} aria-label={`${fmt(t.daily.tally, { n: tally })}. ${t.daily.tallyHint}`} data-testid="tally">
                <CoinIcon className="size-3" /> +{tally}
              </span>
            )}
          </div>
        </div>
        {set.subject === 'math' && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-subject-math/10 px-2.5 py-1 text-sm font-semibold text-subject-math tabular" title={t.daily.timerHint} aria-label={`${t.daily.timer}: ${timer}`} data-testid="stopwatch">
            <Timer className="size-4" /> {timer}
          </span>
        )}
        <Button variant="ghost" size="icon" onClick={onClose} aria-label={t.daily.close}><X /></Button>
      </div>

      <form onSubmit={onSubmit} className="rounded-3xl border bg-card p-5 shadow-xs sm:p-6" noValidate>
        {passage && (
          <div className="mb-4 rounded-2xl bg-muted/60 p-4">
            <div className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{t.daily.passage}</div>
            <p className="text-[15px] leading-relaxed whitespace-pre-line">{passage}</p>
          </div>
        )}
        <h2 className="text-lg leading-snug font-semibold whitespace-pre-line sm:text-xl">{item.prompt}</h2>
        {note && <p className="mt-1.5 text-sm text-muted-foreground">{t.daily.note}: {note}</p>}

        <div className="mt-5">
          {item.answer_mode === 'choice' && (
            <div className="grid gap-2" role="radiogroup" aria-label={item.prompt}>
              {(item.body.options ?? []).map((opt, i) => {
                const picked = shownChoice === i
                const right = result && isCorrectOption(result.correct_answer, i)
                const wrongPick = result && picked && !right
                return (
                  <button
                    key={i} type="button" role="radio" aria-checked={picked} disabled={locked}
                    onClick={() => setChoice(i)}
                    className={cn(
                      'flex min-h-12 items-center gap-3 rounded-2xl border-2 px-4 py-2.5 text-left text-[15px] font-medium transition-all',
                      !locked && (picked ? 'border-primary bg-primary-soft' : 'hover:border-primary/40 hover:bg-muted active:scale-[0.99]'),
                      right && 'border-success bg-success/10',
                      wrongPick && 'border-destructive bg-destructive/10',
                      locked && !right && !wrongPick && 'opacity-60',
                    )}
                  >
                    <span className={cn('grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold',
                      right ? 'bg-success text-white' : wrongPick ? 'bg-destructive text-white' : picked ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                      {right ? <CircleCheck className="size-4" /> : wrongPick ? <CircleX className="size-4" /> : String.fromCharCode(65 + i)}
                    </span>
                    <span className="min-w-0 flex-1">{opt}</span>
                  </button>
                )
              })}
            </div>
          )}

          {item.answer_mode === 'exact' && (
            <Input
              value={value} onChange={(e) => setValue(e.target.value)} disabled={locked} autoFocus
              placeholder={t.daily.answerPlaceholder} aria-label={t.daily.yourAnswer}
              autoComplete="off" autoCapitalize="none" spellCheck={false} enterKeyHint="done"
              inputMode={set.subject === 'math' ? 'decimal' : 'text'}
              className={cn('h-12 rounded-xl text-lg disabled:opacity-100',
                result && (result.is_correct ? 'border-success bg-success/5' : 'border-destructive bg-destructive/5'))}
            />
          )}

          {item.answer_mode === 'text' && (
            <Textarea
              value={text} onChange={(e) => setText(e.target.value)} disabled={locked} rows={6} maxLength={5000}
              placeholder={t.daily.textPlaceholder} aria-label={t.daily.yourAnswer} className="rounded-xl text-[15px] disabled:opacity-100"
            />
          )}
        </div>

        {/* feedback */}
        <div aria-live="polite">
          {result && (result.answer_mode === 'text' ? (
            <div className="mt-4 flex items-center gap-2.5 rounded-2xl bg-primary-soft px-4 py-3 text-sm font-medium text-primary motion-safe:animate-in motion-safe:fade-in">
              <Hourglass className="size-5 shrink-0" /> {t.daily.sent}
            </div>
          ) : result.is_correct ? (
            <div className="mt-4 flex items-center gap-2.5 rounded-2xl bg-success/10 px-4 py-3 text-success motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1" data-testid="feedback-correct">
              <CircleCheck className="size-6 shrink-0" />
              <span className="flex-1 font-semibold">{t.daily.correct}</span>
              {result.coins_awarded > 0 && (
                <span className="text-right text-sm leading-tight font-semibold">
                  {fmt(t.daily.coinsEarned, { n: result.coins_awarded })}
                  <span className="block text-[11px] font-normal opacity-80">{fmt(t.daily.tally, { n: tally })}</span>
                </span>
              )}
            </div>
          ) : (
            <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-destructive/10 px-4 py-3 text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1" data-testid="feedback-wrong">
              <CircleX className="mt-0.5 size-6 shrink-0" />
              <div>
                <div className="font-semibold">{t.daily.wrong}</div>
                {correctText(item, result.correct_answer) && (
                  <div className="text-sm text-foreground">{fmt(t.daily.correctAnswer, { a: correctText(item, result.correct_answer)! })}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5">
          {result ? (
            <Button type="button" className="h-12 w-full rounded-xl text-base" onClick={goNext} autoFocus>
              {isLast ? t.daily.finish : t.daily.next} <ArrowRight />
            </Button>
          ) : (
            <Button type="submit" className="h-12 w-full rounded-xl text-base" disabled={!canSubmit}>
              {submit.isPending ? <Loader2 className="animate-spin" /> : item.answer_mode === 'text' && <Send />}
              {item.answer_mode === 'text' ? t.daily.send : t.daily.check}
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
