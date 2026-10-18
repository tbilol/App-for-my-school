import { useMemo, useState } from 'react'
import { EllipsisVertical, KeyRound, Link2, Trash2, UserPlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { UserAvatar } from '@/components/UserAvatar'
import { useAuth } from '@/features/auth/AuthProvider'
import { useT } from '@/i18n'
import {
  useCreateParent, useDeleteMember, useLinkParent, useManagedClasses, useParents, useResetPassword, useStudents,
  useUnlinkParent, type Member, type ParentWithChildren,
} from './api'
import { AccountFields, ConfirmDialog, CredentialsDialog, FormDialog, PasswordWithGenerate, type IssuedCredentials } from './dialogs'

/** Pick students from the caller's classes; selection survives switching class. */
function ChildPicker({ value, onChange, exclude = [] }: { value: string[]; onChange: (ids: string[]) => void; exclude?: string[] }) {
  const t = useT()
  const classes = useManagedClasses()
  const students = useStudents()
  const [classId, setClassId] = useState('')
  const current = classId || classes.data?.[0]?.id || ''
  const list = (students.data ?? []).filter((s) => s.class_id === current && !exclude.includes(s.id))
  const byId = new Map((students.data ?? []).map((s) => [s.id, s]))

  return (
    <div className="space-y-2">
      <Label>{t.manage.pickChildren}</Label>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 rounded-full bg-primary-soft py-0.5 pr-1 pl-2.5 text-xs font-medium text-primary">
              {byId.get(id)?.full_name}
              <button type="button" onClick={() => onChange(value.filter((v) => v !== id))} className="rounded-full p-0.5 hover:bg-primary/10" aria-label={t.manage.unlink}>
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Select value={current} onValueChange={setClassId}>
        <SelectTrigger className="w-full" aria-label={t.manage.selectClass}><SelectValue placeholder={t.manage.selectClass} /></SelectTrigger>
        <SelectContent>{(classes.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
      </Select>
      <ul className="max-h-52 divide-y overflow-y-auto rounded-lg border">
        {list.map((s) => (
          <li key={s.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted">
              <Checkbox
                checked={value.includes(s.id)}
                onCheckedChange={(c) => onChange(c ? [...value, s.id] : value.filter((v) => v !== s.id))}
              />
              {s.full_name}
            </label>
          </li>
        ))}
        {list.length === 0 && <li className="px-3 py-4 text-center text-xs text-muted-foreground">{t.common.emptyList}</li>}
      </ul>
    </div>
  )
}

type Dialog =
  | { kind: 'create' }
  | { kind: 'link' | 'reset' | 'delete'; parent: ParentWithChildren }
  | { kind: 'unlink'; parent: ParentWithChildren; child: Member }
  | null

export function ParentsManager() {
  const t = useT()
  const { hasRole } = useAuth()
  const isAdmin = hasRole('admin', 'super_admin')
  const parents = useParents()
  const students = useStudents()
  const createParent = useCreateParent()
  const linkParent = useLinkParent()
  const unlinkParent = useUnlinkParent()
  const resetPassword = useResetPassword()
  const deleteMember = useDeleteMember()

  const [dialog, setDialog] = useState<Dialog>(null)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [children, setChildren] = useState<string[]>([])
  const [issued, setIssued] = useState<IssuedCredentials | null>(null)
  const studentById = useMemo(() => new Map((students.data ?? []).map((s) => [s.id, s])), [students.data])
  const close = () => setDialog(null)

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => { setName(''); setPassword(''); setChildren([]); setDialog({ kind: 'create' }) }}>
          <UserPlus /> {t.manage.addParent}
        </Button>
      </div>

      {parents.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : !parents.data?.length ? (
        <p className="rounded-xl border border-dashed bg-muted p-8 text-center text-sm text-muted-foreground">{t.manage.noParents}</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {parents.data.map((p) => (
            <li key={p.id} className="flex items-start gap-3 px-3 py-3 sm:px-4">
              <UserAvatar name={p.full_name} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{p.full_name}</div>
                <div className="truncate font-mono text-xs text-muted-foreground">{p.login}</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {p.childIds.map((id) => {
                    const child = studentById.get(id)
                    // children outside this teacher's classes are hidden by RLS; show what we can see
                    if (!child) return null
                    return (
                      <span key={id} className="inline-flex items-center gap-1 rounded-full bg-secondary py-0.5 pr-1 pl-2.5 text-xs">
                        {child.full_name}
                        <button
                          onClick={() => setDialog({ kind: 'unlink', parent: p, child })}
                          className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                          aria-label={`${t.manage.unlink}: ${child.full_name}`}
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    )
                  })}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={`${t.common.actions}: ${p.full_name}`}><EllipsisVertical /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => { setChildren([]); setDialog({ kind: 'link', parent: p }) }}>
                    <Link2 /> {t.manage.linkChild}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => { setPassword(''); setDialog({ kind: 'reset', parent: p }) }}>
                    <KeyRound /> {t.manage.resetPassword}
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => setDialog({ kind: 'delete', parent: p })}>
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

      {dialog?.kind === 'create' && (
        <FormDialog
          open onOpenChange={(o) => !o && close()} title={t.manage.addParent} submitLabel={t.common.create}
          canSubmit={!!name.trim() && password.length >= 6 && children.length > 0}
          onSubmit={async () => {
            const r = await createParent.mutateAsync({ fullName: name, password, studentIds: children })
            setIssued({ name: name.trim().replace(/\s+/g, ' '), login: r.login, password })
          }}
        >
          <AccountFields name={name} onName={setName} password={password} onPassword={setPassword} />
          <ChildPicker value={children} onChange={setChildren} />
        </FormDialog>
      )}

      {dialog?.kind === 'link' && (
        <FormDialog
          open onOpenChange={(o) => !o && close()} title={t.manage.linkChild} description={dialog.parent.full_name}
          submitLabel={t.common.save} canSubmit={children.length > 0}
          onSubmit={async () => {
            for (const studentId of children) await linkParent.mutateAsync({ parentId: dialog.parent.id, studentId })
          }}
        >
          <ChildPicker value={children} onChange={setChildren} exclude={dialog.parent.childIds} />
        </FormDialog>
      )}

      {dialog?.kind === 'reset' && (
        <FormDialog
          open onOpenChange={(o) => !o && close()} title={`${t.manage.resetPassword}: ${dialog.parent.full_name}`}
          description={t.manage.resetSignsOut} submitLabel={t.common.save} canSubmit={password.length >= 6}
          onSubmit={async () => {
            await resetPassword.mutateAsync({ userId: dialog.parent.id, newPassword: password })
            setIssued({ name: dialog.parent.full_name, login: dialog.parent.login, password })
          }}
        >
          <PasswordWithGenerate id="reset-password" value={password} onChange={setPassword} />
        </FormDialog>
      )}

      {dialog?.kind === 'unlink' && (
        <ConfirmDialog
          open onOpenChange={(o) => !o && close()} title={t.manage.unlink}
          description={`${dialog.parent.full_name} ↔ ${dialog.child.full_name}`} confirmLabel={t.manage.unlink}
          onConfirm={() => unlinkParent.mutateAsync({ parentId: dialog.parent.id, studentId: dialog.child.id })}
        />
      )}

      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          open onOpenChange={(o) => !o && close()} title={`${t.common.delete}: ${dialog.parent.full_name}`}
          description={t.manage.deleteConfirm} confirmLabel={t.common.delete}
          onConfirm={() => deleteMember.mutateAsync({ userId: dialog.parent.id })}
        />
      )}

      <CredentialsDialog issued={issued} onClose={() => setIssued(null)} />
    </div>
  )
}
