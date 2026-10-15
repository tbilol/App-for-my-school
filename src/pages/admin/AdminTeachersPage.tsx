import { useMemo, useState } from 'react'
import { EllipsisVertical, KeyRound, Pencil, School, Trash2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PageHeader } from '@/components/PageHeader'
import { UserAvatar } from '@/components/UserAvatar'
import {
  useAssignments, useCreateTeacher, useDeleteMember, useManagedClasses, useResetPassword, useSetTeacherClasses,
  useTeachers, useUpdateMember, type Member,
} from '@/features/manage/api'
import {
  AccountFields, ConfirmDialog, CredentialsDialog, FormDialog, PasswordWithGenerate, type IssuedCredentials,
} from '@/features/manage/dialogs'
import { useT } from '@/i18n'

type Dialog = { kind: 'create' } | { kind: 'assign' | 'rename' | 'reset' | 'delete'; teacher: Member } | null

export default function AdminTeachersPage() {
  const t = useT()
  const teachers = useTeachers()
  const classes = useManagedClasses()
  const assignments = useAssignments()
  const createTeacher = useCreateTeacher()
  const setTeacherClasses = useSetTeacherClasses()
  const updateMember = useUpdateMember()
  const resetPassword = useResetPassword()
  const deleteMember = useDeleteMember()

  const [dialog, setDialog] = useState<Dialog>(null)
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [password, setPassword] = useState('')
  const [issued, setIssued] = useState<IssuedCredentials | null>(null)
  const close = () => setDialog(null)

  const classesOf = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const a of assignments.data ?? []) m.set(a.teacher_id, [...(m.get(a.teacher_id) ?? []), a.class_id])
    return m
  }, [assignments.data])
  const className = useMemo(() => new Map((classes.data ?? []).map((c) => [c.id, c.name])), [classes.data])

  const classChecklist = (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {(classes.data ?? []).map((c) => (
        <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-primary-soft">
          <Checkbox checked={selected.includes(c.id)} onCheckedChange={(v) => setSelected(v ? [...selected, c.id] : selected.filter((x) => x !== c.id))} />
          {c.name}
        </label>
      ))}
    </div>
  )

  return (
    <>
      <PageHeader
        title={t.nav.teachers}
        action={<Button onClick={() => { setName(''); setPassword(''); setSelected([]); setDialog({ kind: 'create' }) }}><UserPlus /> {t.admin.createTeacher}</Button>}
      />
      {teachers.isPending ? <Skeleton className="h-48 w-full" /> : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {(teachers.data ?? []).map((x) => (
            <li key={x.id} className="flex items-center gap-3 px-4 py-3">
              <UserAvatar name={x.full_name} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{x.full_name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-xs text-muted-foreground">{x.login}</span>
                  {(classesOf.get(x.id) ?? []).map((id) => (
                    <span key={id} className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">{className.get(id)}</span>
                  ))}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`${t.common.actions}: ${x.full_name}`}><EllipsisVertical /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => { setSelected(classesOf.get(x.id) ?? []); setDialog({ kind: 'assign', teacher: x }) }}><School /> {t.admin.assignClasses}</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => { setName(x.full_name); setDialog({ kind: 'rename', teacher: x }) }}><Pencil /> {t.manage.rename}</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => { setPassword(''); setDialog({ kind: 'reset', teacher: x }) }}><KeyRound /> {t.manage.resetPassword}</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setDialog({ kind: 'delete', teacher: x })}><Trash2 /> {t.common.delete}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}

      {dialog?.kind === 'create' && (
        <FormDialog
          open onOpenChange={(o) => !o && close()} title={t.admin.createTeacher}
          submitLabel={t.common.create} canSubmit={!!name.trim() && password.length >= 6}
          onSubmit={async () => {
            const r = await createTeacher.mutateAsync({ fullName: name, password })
            if (selected.length) await setTeacherClasses.mutateAsync({ teacherId: r.user_id, classIds: selected })
            setIssued({ name: name.trim().replace(/\s+/g, ' '), login: r.login, password })
          }}
        >
          <AccountFields name={name} onName={setName} password={password} onPassword={setPassword} />
          <div className="space-y-2">
            <Label>{t.admin.assignedClasses}</Label>
            {classChecklist}
          </div>
        </FormDialog>
      )}

      {dialog?.kind === 'assign' && (
        <FormDialog
          open onOpenChange={(o) => !o && close()} title={t.admin.assignClasses} description={dialog.teacher.full_name}
          submitLabel={t.common.save} onSubmit={() => setTeacherClasses.mutateAsync({ teacherId: dialog.teacher.id, classIds: selected })}
        >
          {classChecklist}
        </FormDialog>
      )}

      {dialog?.kind === 'rename' && (
        <FormDialog
          open onOpenChange={(o) => !o && close()} title={t.manage.rename} submitLabel={t.common.save}
          canSubmit={!!name.trim() && name.trim() !== dialog.teacher.full_name}
          onSubmit={() => updateMember.mutateAsync({ userId: dialog.teacher.id, fullName: name })}
        >
          <div className="space-y-2">
            <Label htmlFor="t-rename">{t.common.name}</Label>
            <Input id="t-rename" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <p className="text-xs text-muted-foreground">{t.manage.renameKeepsLogin}</p>
          </div>
        </FormDialog>
      )}

      {dialog?.kind === 'reset' && (
        <FormDialog
          open onOpenChange={(o) => !o && close()} title={`${t.manage.resetPassword}: ${dialog.teacher.full_name}`}
          description={t.manage.resetSignsOut} submitLabel={t.common.save} canSubmit={password.length >= 6}
          onSubmit={async () => {
            await resetPassword.mutateAsync({ userId: dialog.teacher.id, newPassword: password })
            setIssued({ name: dialog.teacher.full_name, login: dialog.teacher.login, password })
          }}
        >
          <PasswordWithGenerate id="reset-password" value={password} onChange={setPassword} />
        </FormDialog>
      )}

      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          open onOpenChange={(o) => !o && close()} title={`${t.common.delete}: ${dialog.teacher.full_name}`}
          description={t.manage.deleteConfirm} confirmLabel={t.common.delete}
          onConfirm={() => deleteMember.mutateAsync({ userId: dialog.teacher.id })}
        />
      )}

      <CredentialsDialog issued={issued} onClose={() => setIssued(null)} />
    </>
  )
}
