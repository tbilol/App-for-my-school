import { useMemo, useState } from 'react'
import { EllipsisVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PageHeader } from '@/components/PageHeader'
import {
  useAssignments, useCreateClass, useDeleteClass, useManagedClasses, useStudents, useTeachers, useUpdateClass,
} from '@/features/manage/api'
import { ConfirmDialog, FormDialog } from '@/features/manage/dialogs'
import { useT } from '@/i18n'
import type { ClassRow } from '@/types/models'

type Dialog = { kind: 'create' } | { kind: 'edit' | 'delete'; cls: ClassRow } | null

export default function AdminClassesPage() {
  const t = useT()
  const classes = useManagedClasses()
  const students = useStudents()
  const teachers = useTeachers()
  const assignments = useAssignments()
  const createClass = useCreateClass()
  const updateClass = useUpdateClass()
  const deleteClass = useDeleteClass()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [form, setForm] = useState({ name: '', grade: '' })
  const close = () => setDialog(null)

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of students.data ?? []) if (s.class_id) m.set(s.class_id, (m.get(s.class_id) ?? 0) + 1)
    return m
  }, [students.data])
  const teacherNames = useMemo(() => {
    const byId = new Map((teachers.data ?? []).map((x) => [x.id, x.full_name]))
    const m = new Map<string, string[]>()
    for (const a of assignments.data ?? []) m.set(a.class_id, [...(m.get(a.class_id) ?? []), byId.get(a.teacher_id) ?? '…'])
    return m
  }, [teachers.data, assignments.data])

  const grade = Number(form.grade)
  const formOk = !!form.name.trim() && Number.isInteger(grade) && grade >= 1 && grade <= 11

  return (
    <>
      <PageHeader
        title={t.nav.classes}
        action={<Button onClick={() => { setForm({ name: '', grade: '' }); setDialog({ kind: 'create' }) }}><Plus /> {t.admin.createClass}</Button>}
      />
      {classes.isPending ? <Skeleton className="h-48 w-full" /> : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {(classes.data ?? []).map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary-soft font-bold text-primary">{c.name}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{counts.get(c.id) ?? 0} {t.manage.studentCount}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {t.admin.teachersOfClass}: {teacherNames.get(c.id)?.join(', ') || t.common.none}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`${t.common.actions}: ${c.name}`}><EllipsisVertical /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => { setForm({ name: c.name, grade: String(c.grade) }); setDialog({ kind: 'edit', cls: c }) }}><Pencil /> {t.common.edit}</DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onSelect={() => setDialog({ kind: 'delete', cls: c })}><Trash2 /> {t.common.delete}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}

      {(dialog?.kind === 'create' || dialog?.kind === 'edit') && (
        <FormDialog
          open onOpenChange={(o) => !o && close()}
          title={dialog.kind === 'create' ? t.admin.createClass : t.common.edit}
          submitLabel={dialog.kind === 'create' ? t.common.create : t.common.save} canSubmit={formOk}
          onSubmit={() => dialog.kind === 'create'
            ? createClass.mutateAsync({ name: form.name, grade })
            : updateClass.mutateAsync({ id: dialog.cls.id, name: form.name, grade })}
        >
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <div className="space-y-2">
              <Label htmlFor="c-name">{t.admin.className}</Label>
              <Input id="c-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t.admin.classNamePlaceholder} autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-grade">{t.admin.grade}</Label>
              <Input id="c-grade" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value.replace(/\D/g, '').slice(0, 2) })} inputMode="numeric" placeholder="9" />
            </div>
          </div>
        </FormDialog>
      )}

      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          open onOpenChange={(o) => !o && close()} title={`${t.common.delete}: ${dialog.cls.name}`}
          description={t.admin.deleteClassConfirm} confirmLabel={t.common.delete}
          onConfirm={() => deleteClass.mutateAsync({ id: dialog.cls.id })}
        />
      )}
    </>
  )
}
