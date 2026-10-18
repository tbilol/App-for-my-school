import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SUBJECTS, useLevels } from '@/features/bank/api'
import { fmt, useT } from '@/i18n'
import type { Subject } from '@/types/models'
import { useSetStudentLevel, type Member } from './api'
import { FormDialog } from './dialogs'

const NONE = '__none'

/**
 * One student's level per subject. Lists active levels (teachers can't see
 * inactive ones anyway); a student already on an inactive level keeps it
 * unless changed. Saves only the subjects that changed.
 */
export function StudentLevelsDialog({ student, current, onClose }: {
  student: Member; current: Partial<Record<Subject, string>>; onClose: () => void
}) {
  const t = useT()
  const levels = useLevels()
  const setLevel = useSetStudentLevel()
  const [picked, setPicked] = useState<Record<Subject, string>>(() =>
    Object.fromEntries(SUBJECTS.map((s) => [s, current[s] ?? NONE])) as Record<Subject, string>)

  const active = useMemo(() => {
    const m = Object.fromEntries(SUBJECTS.map((s) => [s, [] as { id: string; name: string }[]])) as Record<Subject, { id: string; name: string }[]>
    for (const l of levels.data ?? []) if (l.active) m[l.subject].push({ id: l.id, name: l.name })
    return m
  }, [levels.data])
  const deepest = Math.max(0, ...SUBJECTS.map((s) => active[s].length))
  const changed = SUBJECTS.filter((s) => picked[s] !== (current[s] ?? NONE))

  return (
    <FormDialog
      open onOpenChange={(o) => !o && onClose()} title={t.studentLevel.title} description={student.full_name}
      submitLabel={t.common.save} canSubmit={changed.length > 0}
      onSubmit={async () => {
        for (const s of changed) {
          await setLevel.mutateAsync({ studentId: student.id, subject: s, levelId: picked[s] === NONE ? null : picked[s] })
        }
        toast.success(t.studentLevel.saved)
      }}
    >
      <p className="text-sm text-muted-foreground">{t.studentLevel.hint}</p>

      {deepest > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{t.studentLevel.sameForAll}</span>
          {Array.from({ length: deepest }, (_, i) => (
            <Button
              key={i} type="button" size="sm" variant="outline" className="h-7 px-2.5 text-xs"
              onClick={() => setPicked(Object.fromEntries(SUBJECTS.map((s) => [s, active[s][i]?.id ?? picked[s]])) as Record<Subject, string>)}
            >
              {fmt(t.studentLevel.position, { n: i + 1 })}
            </Button>
          ))}
        </div>
      )}

      {SUBJECTS.map((s) => {
        const value = picked[s]
        const isInactive = value !== NONE && !active[s].some((l) => l.id === value)
        return (
          <div key={s} className="space-y-2">
            <Label>{t.subjects[s]}</Label>
            <Select value={value} onValueChange={(v) => setPicked({ ...picked, [s]: v })} disabled={levels.isPending}>
              <SelectTrigger className="w-full" aria-label={t.subjects[s]}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t.studentLevel.none}</SelectItem>
                {isInactive && (
                  <SelectItem value={value} disabled>
                    {(levels.data ?? []).find((l) => l.id === value)?.name ?? ''} {t.studentLevel.inactiveCurrent}
                  </SelectItem>
                )}
                {active[s].map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )
      })}
    </FormDialog>
  )
}
