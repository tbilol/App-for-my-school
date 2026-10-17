import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, CheckCircle2, EllipsisVertical, Pencil, Plus, Power, PowerOff } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PageHeader } from '@/components/PageHeader'
import {
  SUBJECTS, SUBJECT_SKILLS, useCreateLevel, useLevels, useRenameLevel, useReorderLevel, useSetLevelActive,
  useSetTaskActive, useTasks, type BankTask,
} from '@/features/bank/api'
import { TaskEditorDialog } from '@/features/bank/TaskEditorDialog'
import { FormDialog } from '@/features/manage/dialogs'
import { errorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { fmt, useT } from '@/i18n'
import type { Level, Subject, TaskSkill } from '@/types/models'

type LevelDialog = { kind: 'create' } | { kind: 'rename'; level: Level } | null
type TaskDialog = { task: BankTask | null } | null

/** Toast wrapper for one-click actions (dialogs show their errors inline). */
async function run(action: () => Promise<unknown>, success: string) {
  try { await action(); toast.success(success) } catch (err) { toast.error(errorMessage(err)) }
}

/** One-line summary of a question's answer, for the list. */
function answerSummary(task: BankTask, correctLabel: string) {
  if (task.answer_mode === 'choice') {
    const idx = task.key?.correct
    const list = Array.isArray(idx) ? idx : idx != null ? [idx] : []
    return `${correctLabel}: ${list.map((i) => task.body.options?.[i] ?? '?').join(', ')}`
  }
  if (task.answer_mode === 'exact') return `${correctLabel}: ${(task.key?.values ?? [task.key?.value ?? '?']).join(' / ')}`
  return null
}

export default function AdminBankPage() {
  const t = useT()
  const levels = useLevels()
  const [subject, setSubject] = useState<Subject>('english')
  const [levelId, setLevelId] = useState<string>('')
  const [skillFilter, setSkillFilter] = useState<TaskSkill | 'all'>('all')
  const [levelDialog, setLevelDialog] = useState<LevelDialog>(null)
  const [taskDialog, setTaskDialog] = useState<TaskDialog>(null)
  const [levelName, setLevelName] = useState('')

  const createLevel = useCreateLevel()
  const renameLevel = useRenameLevel()
  const setLevelActive = useSetLevelActive()
  const reorderLevel = useReorderLevel()
  const setTaskActive = useSetTaskActive()

  const subjectLevels = useMemo(() => (levels.data ?? []).filter((l) => l.subject === subject), [levels.data, subject])
  const level = subjectLevels.find((l) => l.id === levelId)
  const tasks = useTasks(level?.id)
  const skills = SUBJECT_SKILLS[subject]

  // keep a valid selection when the subject or the level list changes
  useEffect(() => {
    if (!subjectLevels.some((l) => l.id === levelId)) setLevelId(subjectLevels[0]?.id ?? '')
  }, [subjectLevels, levelId])
  useEffect(() => setSkillFilter('all'), [subject])

  const activeBySkill = useMemo(() => {
    const m = new Map<TaskSkill, number>()
    for (const x of tasks.data ?? []) if (x.active) m.set(x.skill, (m.get(x.skill) ?? 0) + 1)
    return m
  }, [tasks.data])
  const shown = (tasks.data ?? []).filter((x) => skillFilter === 'all' || x.skill === skillFilter)

  return (
    <>
      <PageHeader title={t.nav.bank} description={t.bank.subtitle} />

      <Tabs value={subject} onValueChange={(v) => setSubject(v as Subject)} className="mb-4">
        <TabsList>
          {SUBJECTS.map((s) => <TabsTrigger key={s} value={s}>{t.subjects[s]}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <div className="grid items-start gap-4 lg:grid-cols-[17rem_1fr]">
        {/* ── Levels */}
        <section className="rounded-xl border bg-card" aria-labelledby="levels-title">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <h2 id="levels-title" className="font-semibold">{t.bank.levels}</h2>
            <Button size="sm" variant="outline" onClick={() => { setLevelName(''); setLevelDialog({ kind: 'create' }) }}>
              <Plus /> {t.bank.addLevel}
            </Button>
          </div>
          {levels.isPending ? <Skeleton className="m-3 h-32" /> : subjectLevels.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t.bank.noLevels}</p>
          ) : (
            <ul className="p-2">
              {subjectLevels.map((l, i) => (
                <li key={l.id}>
                  <div className={cn('group flex items-center gap-1 rounded-lg pr-1', l.id === levelId ? 'bg-primary-soft' : 'hover:bg-secondary')}>
                    <button
                      type="button" onClick={() => setLevelId(l.id)} aria-current={l.id === levelId ? 'true' : undefined}
                      className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left"
                    >
                      <span className={cn('grid size-7 shrink-0 place-items-center rounded-md text-xs font-bold',
                        l.id === levelId ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground')}>{i + 1}</span>
                      <span className={cn('truncate text-sm font-medium', l.id === levelId && 'text-primary', !l.active && 'text-muted-foreground line-through')}>{l.name}</span>
                      {!l.active && <Badge variant="outline" className="ml-auto text-[10px]">{t.bank.inactive}</Badge>}
                    </button>
                    <Button
                      variant="ghost" size="icon" className="size-7" disabled={i === 0} aria-label={`${t.bank.moveUp}: ${l.name}`}
                      onClick={() => run(() => reorderLevel.mutateAsync({ id: l.id, position: i }), t.bank.levelSaved)}
                    ><ArrowUp /></Button>
                    <Button
                      variant="ghost" size="icon" className="size-7" disabled={i === subjectLevels.length - 1} aria-label={`${t.bank.moveDown}: ${l.name}`}
                      onClick={() => run(() => reorderLevel.mutateAsync({ id: l.id, position: i + 2 }), t.bank.levelSaved)}
                    ><ArrowDown /></Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7" aria-label={`${t.common.actions}: ${l.name}`}><EllipsisVertical /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => { setLevelName(l.name); setLevelDialog({ kind: 'rename', level: l }) }}>
                          <Pencil /> {t.bank.renameLevel}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => run(() => setLevelActive.mutateAsync({ id: l.id, active: !l.active }), l.active ? t.bank.deactivated : t.bank.activated)}>
                          {l.active ? <><PowerOff /> {t.bank.deactivate}</> : <><Power /> {t.bank.activate}</>}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Questions of the selected level */}
        <section className="min-w-0 rounded-xl border bg-card" aria-labelledby="questions-title">
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
            <h2 id="questions-title" className="font-semibold">
              {t.bank.questions}{level && <span className="text-muted-foreground"> · {level.name}</span>}
            </h2>
            {level && !level.active && <Badge variant="outline" title={t.bank.inactiveLevelHint}>{t.bank.inactive}</Badge>}
            <Button size="sm" className="ml-auto" disabled={!level} onClick={() => setTaskDialog({ task: null })}>
              <Plus /> {t.bank.addQuestion}
            </Button>
          </div>

          {!level ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">{subjectLevels.length ? t.bank.selectLevel : t.bank.noLevels}</p>
          ) : (
            <>
              {/* skill filter + active count per skill */}
              <div className="flex flex-wrap gap-1.5 border-b px-4 py-2.5" role="group" aria-label={t.bank.skill}>
                {(skills.length > 1 ? (['all', ...skills] as const) : skills).map((s) => (
                  <button
                    key={s} type="button" onClick={() => setSkillFilter(s)} aria-pressed={skillFilter === s}
                    className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      skillFilter === s || skills.length === 1 ? 'border-primary bg-primary-soft text-primary' : 'text-muted-foreground hover:bg-secondary')}
                  >
                    {s === 'all' ? t.bank.all : t.bank.skills[s]}
                    {s !== 'all' && <span className="ml-1.5 opacity-70">{fmt(t.bank.activeCount, { n: activeBySkill.get(s) ?? 0 })}</span>}
                  </button>
                ))}
              </div>

              {tasks.isPending ? <Skeleton className="m-4 h-40" /> : shown.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {tasks.data?.length ? t.bank.noQuestionsFiltered : t.bank.noQuestions}
                </p>
              ) : (
                <ul className="divide-y">
                  {shown.map((x) => {
                    const summary = answerSummary(x, t.bank.correct)
                    return (
                      <li key={x.id} className={cn('flex items-start gap-3 px-4 py-3', !x.active && 'opacity-60')}>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-1.5">
                            <Badge variant="secondary">{t.bank.skills[x.skill]}</Badge>
                            <Badge variant="outline">{t.bank.modes[x.answer_mode]}</Badge>
                            <span className="text-xs text-muted-foreground">{t.bank.difficultyLevels[Math.min(x.difficulty, 3) as 1 | 2 | 3]}</span>
                            {!x.active && <Badge variant="outline">{t.bank.inactive}</Badge>}
                          </div>
                          {typeof x.body.passage === 'string' && <p className="line-clamp-1 text-xs text-muted-foreground italic">{x.body.passage}</p>}
                          <p className="line-clamp-2 text-sm font-medium">{x.prompt}</p>
                          {x.answer_mode === 'choice' && (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">{x.body.options?.join(' · ')}</p>
                          )}
                          {summary && (
                            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-success">
                              <CheckCircle2 className="size-3.5 shrink-0" /> <span className="truncate">{summary}</span>
                            </p>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`${t.common.actions}: ${x.prompt.slice(0, 40)}`}><EllipsisVertical /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setTaskDialog({ task: x })}><Pencil /> {t.common.edit}</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => run(() => setTaskActive.mutateAsync({ id: x.id, active: !x.active }), x.active ? t.bank.deactivated : t.bank.activated)}>
                              {x.active ? <><PowerOff /> {t.bank.deactivate}</> : <><Power /> {t.bank.activate}</>}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          )}
        </section>
      </div>

      {levelDialog && (
        <FormDialog
          open onOpenChange={(o) => !o && setLevelDialog(null)}
          title={levelDialog.kind === 'create' ? t.bank.addLevel : t.bank.renameLevel}
          description={t.subjects[subject]}
          submitLabel={levelDialog.kind === 'create' ? t.common.create : t.common.save}
          canSubmit={!!levelName.trim() && (levelDialog.kind === 'create' || levelName.trim() !== levelDialog.level.name)}
          onSubmit={async () => {
            if (levelDialog.kind === 'create') {
              const l = await createLevel.mutateAsync({ subject, name: levelName })
              setLevelId(l.id)
              toast.success(t.bank.levelCreated)
            } else {
              await renameLevel.mutateAsync({ id: levelDialog.level.id, name: levelName })
              toast.success(t.bank.levelSaved)
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="level-name">{t.bank.levelName}</Label>
            <Input id="level-name" value={levelName} onChange={(e) => setLevelName(e.target.value)} placeholder={t.bank.levelNamePlaceholder} maxLength={40} autoFocus />
          </div>
        </FormDialog>
      )}

      {taskDialog && level && <TaskEditorDialog level={level} task={taskDialog.task} onClose={() => setTaskDialog(null)} />}
    </>
  )
}
