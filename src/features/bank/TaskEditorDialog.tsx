import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormDialog } from '@/features/manage/dialogs'
import { fmt, useT } from '@/i18n'
import { cn } from '@/lib/utils'
import type { AnswerMode, Level, TaskBody, TaskSkill } from '@/types/models'
import { SUBJECT_SKILLS, defaultMode, useCreateTask, useUpdateTask, type BankTask, type TaskKey } from './api'

const MAX_OPTIONS = 6

/** Segmented single-choice control (answer mode, difficulty). */
function Segmented<T extends string | number>({ value, onChange, items, label }: {
  value: T; onChange: (v: T) => void; items: { value: T; label: string }[]; label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border bg-muted p-0.5">
      {items.map((i) => (
        <button
          key={String(i.value)} type="button" role="radio" aria-checked={value === i.value}
          onClick={() => onChange(i.value)}
          className={cn('rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            value === i.value ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground')}
        >
          {i.label}
        </button>
      ))}
    </div>
  )
}

function firstCorrect(key: TaskKey | null) {
  const c = key?.correct
  return Array.isArray(c) ? (c[0] ?? 0) : (c ?? 0)
}

/**
 * Add / edit one bank question. Subject + level come from the page; fields
 * follow the skill: choice → options + correct one, exact → accepted answers,
 * writing → prompt (+ guidance) only.
 */
export function TaskEditorDialog({ level, task, onClose }: { level: Level; task: BankTask | null; onClose: () => void }) {
  const t = useT()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const skills = SUBJECT_SKILLS[level.subject]

  const [skill, setSkill] = useState<TaskSkill>(task?.skill ?? skills[0])
  const [mode, setMode] = useState<AnswerMode>(task?.answer_mode ?? defaultMode(skills[0]))
  const [prompt, setPrompt] = useState(task?.prompt ?? '')
  const [passage, setPassage] = useState(typeof task?.body.passage === 'string' ? task.body.passage : '')
  const [note, setNote] = useState(typeof task?.body.note === 'string' ? task.body.note : '')
  const [options, setOptions] = useState<string[]>(task?.body.options?.length ? task.body.options : ['', '', ''])
  const [correct, setCorrect] = useState(firstCorrect(task?.key ?? null))
  const [accepted, setAccepted] = useState<string[]>(
    task?.key?.values?.length ? task.key.values : task?.key?.value != null ? [String(task.key.value)] : [''])
  const [difficulty, setDifficulty] = useState(Math.min(Math.max(task?.difficulty ?? 1, 1), 3))

  function changeSkill(s: TaskSkill) {
    setSkill(s)
    if (s === 'writing') setMode('text')
    else if (mode === 'text') setMode(defaultMode(s))
  }

  // Options are sent without blanks; the correct index is remapped to match.
  const filled = options.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o)
  const correctIdx = filled.findIndex((x) => x.i === correct)
  const values = accepted.map((v) => v.trim()).filter(Boolean)
  const canSubmit = !!prompt.trim() && (
    mode === 'choice' ? filled.length >= 2 && correctIdx >= 0
      : mode === 'exact' ? values.length > 0
        : true)

  async function submit() {
    // keep body keys this editor doesn't manage; set/clear the ones it does
    const { options: _o, passage: _p, note: _n, ...rest } = task?.body ?? ({} as TaskBody)
    const body: TaskBody = { ...rest }
    if (mode === 'choice') body.options = filled.map((x) => x.o)
    if (skill === 'reading' && passage.trim()) body.passage = passage.trim()
    if (mode === 'text' && note.trim()) body.note = note.trim()
    const answer: TaskKey | null =
      mode === 'choice' ? { correct: correctIdx }
        : mode === 'exact' ? (values.length === 1 ? { value: values[0] } : { values })
          : null
    const input = { subject: level.subject, levelId: level.id, skill, answerMode: mode, prompt: prompt.trim(), body, answer, difficulty }
    if (task) {
      await updateTask.mutateAsync({ ...input, id: task.id })
      toast.success(t.bank.questionSaved)
    } else {
      await createTask.mutateAsync(input)
      toast.success(t.bank.questionCreated)
    }
  }

  return (
    <FormDialog
      open onOpenChange={(o) => !o && onClose()}
      title={task ? t.bank.editQuestion : t.bank.addQuestion}
      description={`${t.subjects[level.subject]} · ${level.name}`}
      submitLabel={task ? t.common.save : t.common.create} canSubmit={canSubmit} onSubmit={submit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t.bank.skill}</Label>
          <Select value={skill} onValueChange={(v) => changeSkill(v as TaskSkill)} disabled={skills.length === 1}>
            <SelectTrigger className="w-full" aria-label={t.bank.skill}><SelectValue /></SelectTrigger>
            <SelectContent>
              {skills.map((s) => <SelectItem key={s} value={s}>{t.bank.skills[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t.bank.difficulty}</Label>
          <div>
            <Segmented label={t.bank.difficulty} value={difficulty} onChange={setDifficulty}
              items={([1, 2, 3] as const).map((d) => ({ value: d, label: t.bank.difficultyLevels[d] }))} />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t.bank.answerMode}</Label>
        {mode === 'text' ? (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{t.bank.writingHint}</p>
        ) : (
          <div>
            <Segmented label={t.bank.answerMode} value={mode} onChange={setMode}
              items={(['choice', 'exact'] as const).map((m) => ({ value: m, label: t.bank.modes[m] }))} />
          </div>
        )}
      </div>

      {skill === 'reading' && (
        <div className="space-y-2">
          <Label htmlFor="task-passage">{t.bank.passage}</Label>
          <Textarea id="task-passage" value={passage} onChange={(e) => setPassage(e.target.value)} placeholder={t.bank.passagePlaceholder} rows={3} />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="task-prompt">{t.bank.prompt}</Label>
        <Textarea id="task-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t.bank.promptPlaceholder} rows={2} autoFocus />
      </div>

      {mode === 'choice' && (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">{t.bank.options}</legend>
          <p className="text-xs text-muted-foreground">{t.bank.correctHint}</p>
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio" name="task-correct" checked={correct === i} onChange={() => setCorrect(i)}
                aria-label={`${t.bank.markCorrect}: ${fmt(t.bank.optionN, { n: i + 1 })}`}
                className="size-4 shrink-0 accent-success"
              />
              <Input
                value={o} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder={fmt(t.bank.optionN, { n: i + 1 })} aria-label={fmt(t.bank.optionN, { n: i + 1 })}
                className={cn(correct === i && 'border-success ring-1 ring-success/30')}
              />
              <Button
                type="button" variant="ghost" size="icon" disabled={options.length <= 2} aria-label={t.bank.removeOption}
                onClick={() => {
                  setOptions(options.filter((_, j) => j !== i))
                  setCorrect(correct === i ? 0 : correct > i ? correct - 1 : correct)
                }}
              ><X /></Button>
            </div>
          ))}
          {options.length < MAX_OPTIONS && (
            <Button type="button" variant="outline" size="sm" onClick={() => setOptions([...options, ''])}><Plus /> {t.bank.addOption}</Button>
          )}
        </fieldset>
      )}

      {mode === 'exact' && (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">{t.bank.accepted}</legend>
          {accepted.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={v} onChange={(e) => setAccepted(accepted.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder={t.bank.answerPlaceholder} aria-label={`${t.bank.accepted} ${i + 1}`} />
              <Button type="button" variant="ghost" size="icon" disabled={accepted.length <= 1} aria-label={t.bank.removeOption}
                onClick={() => setAccepted(accepted.filter((_, j) => j !== i))}><X /></Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setAccepted([...accepted, ''])}><Plus /> {t.bank.addAccepted}</Button>
          <p className="text-xs text-muted-foreground">{t.bank.acceptedHint}</p>
        </fieldset>
      )}

      {mode === 'text' && (
        <div className="space-y-2">
          <Label htmlFor="task-note">{t.bank.note}</Label>
          <Input id="task-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.bank.notePlaceholder} />
        </div>
      )}
    </FormDialog>
  )
}
