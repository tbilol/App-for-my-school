import { useEffect, useMemo, useState } from 'react'
import { ArrowRightLeft, EllipsisVertical, KeyRound, Pencil, Trash2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CoinAmount } from '@/components/CoinAmount'
import { UserAvatar } from '@/components/UserAvatar'
import { useAuth } from '@/features/auth/AuthProvider'
import { useT } from '@/i18n'
import {
  useAddStudent, useDeleteMember, useManagedClasses, useResetPassword, useStudents, useUpdateMember, type Member,
} from './api'
import { AccountFields, ConfirmDialog, CredentialsDialog, FormDialog, PasswordWithGenerate, type IssuedCredentials } from './dialogs'

type Dialog =
  | { kind: 'add' }
  | { kind: 'rename' | 'move' | 'reset' | 'delete'; member: Member }
  | null

const MIN_PASSWORD = 6   // server enforces app_config.auth.min_password_length

/** Roster of one class at a time. Teachers see their assigned classes; admin sees all. */
export function StudentRoster() {
  const t = useT()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const classes = useManagedClasses()
  const students = useStudents()
  const [classId, setClassId] = useState<string>('')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [issued, setIssued] = useState<IssuedCredentials | null>(null)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [targetClass, setTargetClass] = useState('')

  const addStudent = useAddStudent()
  const updateMember = useUpdateMember()
  const resetPassword = useResetPassword()
  const deleteMember = useDeleteMember()

  // default to the first class once loaded
  useEffect(() => {
    if (!classId && classes.data?.length) setClassId(classes.data[0].id)
  }, [classes.data, classId])

  const roster = useMemo(() => (students.data ?? []).filter((s) => s.class_id === classId), [students.data, classId])
  const close = () => setDialog(null)

  if (classes.isPending) return <Skeleton className="h-40 w-full" />
  if (!classes.data?.length) {
    return <p className="rounded-xl border border-dashed bg-muted p-8 text-center text-sm text-muted-foreground">{t.manage.noClasses}</p>
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={classId} onValueChange={setClassId}>
          <SelectTrigger className="h-10 w-40" aria-label={t.manage.selectClass}><SelectValue placeholder={t.manage.selectClass} /></SelectTrigger>
          <SelectContent>
            {classes.data.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{roster.length} {t.manage.studentCount}</span>
        <Button className="ml-auto" onClick={() => { setName(''); setPassword(''); setDialog({ kind: 'add' }) }}>
          <UserPlus /> <span className="max-sm:sr-only">{t.manage.addStudent}</span>
        </Button>
      </div>

      {students.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : roster.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-muted p-8 text-center text-sm text-muted-foreground">{t.manage.emptyRoster}</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {roster.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
              <UserAvatar name={s.full_name} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{s.full_name}</div>
                <div className="truncate font-mono text-xs text-muted-foreground">{s.login}</div>
              </div>
              <CoinAmount value={s.coin_balance} className="text-sm" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={`${t.common.actions}: ${s.full_name}`}><EllipsisVertical /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => { setName(s.full_name); setDialog({ kind: 'rename', member: s }) }}>
                    <Pencil /> {t.manage.rename}
                  </DropdownMenuItem>
                  {classes.data.length > 1 && (
                    <DropdownMenuItem onSelect={() => { setTargetClass(''); setDialog({ kind: 'move', member: s }) }}>
                      <ArrowRightLeft /> {t.manage.moveClass}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={() => { setPassword(''); setDialog({ kind: 'reset', member: s }) }}>
                    <KeyRound /> {t.manage.resetPassword}
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => setDialog({ kind: 'delete', member: s })}>
                        <Trash2 /> {t.common.delete}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}

      {dialog?.kind === 'add' && (
        <FormDialog
          open onOpenChange={(o) => !o && close()} title={t.manage.addStudent}
          description={classes.data.find((c) => c.id === classId)?.name} submitLabel={t.common.create}
          canSubmit={!!name.trim() && password.length >= MIN_PASSWORD}
          onSubmit={async () => {
            const r = await addStudent.mutateAsync({ classId, fullName: name, password })
            setIssued({ name: name.trim().replace(/\s+/g, ' '), login: r.login, password })
          }}
        >
          <AccountFields name={name} onName={setName} password={password} onPassword={setPassword} />
        </FormDialog>
      )}

      {dialog?.kind === 'rename' && (
        <FormDialog
          open onOpenChange={(o) => !o && close()} title={t.manage.rename} description={t.manage.renameKeepsLogin}
          submitLabel={t.common.save} canSubmit={!!name.trim() && name.trim() !== dialog.member.full_name}
          onSubmit={() => updateMember.mutateAsync({ userId: dialog.member.id, fullName: name })}
        >
          <div className="space-y-2">
            <Label htmlFor="rename">{t.common.name}</Label>
            <Input id="rename" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
        </FormDialog>
      )}

      {dialog?.kind === 'move' && (
        <FormDialog
          open onOpenChange={(o) => !o && close()} title={t.manage.moveClass} description={dialog.member.full_name}
          submitLabel={t.common.save} canSubmit={!!targetClass}
          onSubmit={() => updateMember.mutateAsync({ userId: dialog.member.id, classId: targetClass })}
        >
          <Select value={targetClass} onValueChange={setTargetClass}>
            <SelectTrigger className="w-full" aria-label={t.manage.selectClass}><SelectValue placeholder={t.manage.selectClass} /></SelectTrigger>
            <SelectContent>
              {classes.data.filter((c) => c.id !== dialog.member.class_id).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormDialog>
      )}

      {dialog?.kind === 'reset' && (
        <FormDialog
          open onOpenChange={(o) => !o && close()} title={`${t.manage.resetPassword}: ${dialog.member.full_name}`}
          description={t.manage.resetSignsOut} submitLabel={t.common.save} canSubmit={password.length >= MIN_PASSWORD}
          onSubmit={async () => {
            await resetPassword.mutateAsync({ userId: dialog.member.id, newPassword: password })
            setIssued({ name: dialog.member.full_name, login: dialog.member.login, password })
          }}
        >
          <PasswordWithGenerate id="reset-password" value={password} onChange={setPassword} />
        </FormDialog>
      )}

      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          open onOpenChange={(o) => !o && close()} title={`${t.common.delete}: ${dialog.member.full_name}`}
          description={t.manage.deleteConfirm} confirmLabel={t.common.delete}
          onConfirm={() => deleteMember.mutateAsync({ userId: dialog.member.id })}
        />
      )}

      <CredentialsDialog issued={issued} onClose={() => setIssued(null)} />
    </div>
  )
}
