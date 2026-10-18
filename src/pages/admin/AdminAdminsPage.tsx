import { useState } from 'react'
import { EllipsisVertical, KeyRound, ShieldCheck, Trash2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PageHeader } from '@/components/PageHeader'
import { UserAvatar } from '@/components/UserAvatar'
import { useAuth } from '@/features/auth/AuthProvider'
import { useAdmins, useCreateAdmin, useDeleteMember, useResetPassword, type Member } from '@/features/manage/api'
import {
  AccountFields, ConfirmDialog, CredentialsDialog, FormDialog, PasswordWithGenerate, type IssuedCredentials,
} from '@/features/manage/dialogs'
import { EmptyState } from '@/features/school/components'
import { useT } from '@/i18n'

type Dialog = { kind: 'create' } | { kind: 'reset' | 'delete'; admin: Member } | null

/** Super admin only: create, reset and delete plain admins. Super admins are listed but not manageable here. */
export default function AdminAdminsPage() {
  const t = useT()
  const { profile } = useAuth()
  const admins = useAdmins()
  const createAdmin = useCreateAdmin()
  const resetPassword = useResetPassword()
  const deleteMember = useDeleteMember()

  const [dialog, setDialog] = useState<Dialog>(null)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [issued, setIssued] = useState<IssuedCredentials | null>(null)
  const close = () => setDialog(null)
  const others = (admins.data ?? []).filter((x) => x.id !== profile?.id)

  return (
    <>
      <PageHeader
        title={t.nav.admins}
        action={<Button onClick={() => { setName(''); setPassword(''); setDialog({ kind: 'create' }) }}><UserPlus /> {t.admin.createAdmin}</Button>}
      />
      {admins.isPending ? <Skeleton className="h-48 w-full" /> : others.length === 0 ? (
        <div className="rounded-xl border bg-card"><EmptyState icon={ShieldCheck} text={t.admin.emptyAdmins} /></div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {others.map((x) => (
            <li key={x.id} className="flex items-center gap-3 px-4 py-3">
              <UserAvatar name={x.full_name} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{x.full_name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-xs text-muted-foreground">{x.login}</span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">{t.roles[x.role]}</span>
                </div>
              </div>
              {x.role === 'admin' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`${t.common.actions}: ${x.full_name}`}><EllipsisVertical /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => { setPassword(''); setDialog({ kind: 'reset', admin: x }) }}><KeyRound /> {t.manage.resetPassword}</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setDialog({ kind: 'delete', admin: x })}><Trash2 /> {t.common.delete}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </li>
          ))}
        </ul>
      )}

      {dialog?.kind === 'create' && (
        <FormDialog
          open onOpenChange={(o) => !o && close()} title={t.admin.createAdmin}
          submitLabel={t.common.create} canSubmit={!!name.trim() && password.length >= 6}
          onSubmit={async () => {
            const r = await createAdmin.mutateAsync({ fullName: name, password })
            setIssued({ name: name.trim().replace(/\s+/g, ' '), login: r.login, password })
          }}
        >
          <AccountFields name={name} onName={setName} password={password} onPassword={setPassword} />
        </FormDialog>
      )}

      {dialog?.kind === 'reset' && (
        <FormDialog
          open onOpenChange={(o) => !o && close()} title={`${t.manage.resetPassword}: ${dialog.admin.full_name}`}
          description={t.manage.resetSignsOut} submitLabel={t.common.save} canSubmit={password.length >= 6}
          onSubmit={async () => {
            await resetPassword.mutateAsync({ userId: dialog.admin.id, newPassword: password })
            setIssued({ name: dialog.admin.full_name, login: dialog.admin.login, password })
          }}
        >
          <PasswordWithGenerate id="reset-password" value={password} onChange={setPassword} />
        </FormDialog>
      )}

      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          open onOpenChange={(o) => !o && close()} title={`${t.common.delete}: ${dialog.admin.full_name}`}
          description={t.manage.deleteConfirm} confirmLabel={t.common.delete}
          onConfirm={() => deleteMember.mutateAsync({ userId: dialog.admin.id })}
        />
      )}

      <CredentialsDialog issued={issued} onClose={() => setIssued(null)} />
    </>
  )
}
