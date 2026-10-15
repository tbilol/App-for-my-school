import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Check, Copy, Dices, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDebounced } from '@/hooks/useDebounced'
import { errorMessage } from '@/lib/errors'
import { generatePassword } from '@/lib/password'
import { useSuggestedLogin } from './api'
import { useT } from '@/i18n'

export interface IssuedCredentials { name: string; login: string; password: string }

function CopyButton({ text, label }: { text: string; label: string }) {
  const t = useT()
  const [done, setDone] = useState(false)
  return (
    <Button
      type="button" variant="ghost" size="icon" aria-label={`${t.manage.copy}: ${label}`}
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500) } catch { /* blocked: text is on screen */ }
      }}
    >
      {done ? <Check className="text-success" /> : <Copy />}
    </Button>
  )
}

/** Shows a new account's login + password once, ready to copy and hand out. */
export function CredentialsDialog({ issued, onClose }: { issued: IssuedCredentials | null; onClose: () => void }) {
  const t = useT()
  const [copiedAll, setCopiedAll] = useState(false)
  useEffect(() => setCopiedAll(false), [issued])

  return (
    <Dialog open={!!issued} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t.manage.credentialsTitle}</DialogTitle>
          <DialogDescription>{t.manage.credentialsHint}</DialogDescription>
        </DialogHeader>
        {issued && (
          <div className="space-y-3 rounded-xl bg-primary-soft p-4">
            <div className="font-semibold">{issued.name}</div>
            {([[t.manage.login, issued.login, 'credential-login'], [t.manage.password, issued.password, 'credential-password']] as const).map(([label, value, testId]) => (
              <div key={label} className="flex items-center gap-2 rounded-lg bg-card px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-muted-foreground uppercase">{label}</div>
                  <div className="truncate font-mono text-lg font-semibold" data-testid={testId}>{value}</div>
                </div>
                <CopyButton text={value} label={label} />
              </div>
            ))}
          </div>
        )}
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="outline"
            onClick={async () => {
              if (!issued) return
              try { await navigator.clipboard.writeText(`${t.manage.login}: ${issued.login}\n${t.manage.password}: ${issued.password}`); setCopiedAll(true) } catch { /* ignore */ }
            }}
          >
            {copiedAll ? <Check /> : <Copy />} {copiedAll ? t.manage.copied : t.manage.copyAll}
          </Button>
          <Button onClick={onClose}>{t.common.close}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Password input + "generate" button. Generated passwords are shown in clear text. */
export function PasswordWithGenerate({ id, value, onChange, minLength = 6 }: { id: string; value: string; onChange: (v: string) => void; minLength?: number }) {
  const t = useT()
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{t.manage.password}</Label>
      <div className="flex gap-2">
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="new-password" spellCheck={false} className="font-mono" />
        <Button type="button" variant="outline" onClick={() => onChange(generatePassword())} title={t.manage.generatePassword}>
          <Dices /> {t.manage.generate}
        </Button>
      </div>
      {value && value.length < minLength && <p className="text-xs text-destructive">{t.manage.passwordTooShort}</p>}
    </div>
  )
}

/** Name + live generated-login preview + password: the "add person" block. */
export function AccountFields({
  name, onName, password, onPassword,
}: { name: string; onName: (v: string) => void; password: string; onPassword: (v: string) => void }) {
  const t = useT()
  const debounced = useDebounced(name)
  const suggestion = useSuggestedLogin(debounced)
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="account-name">{t.common.name}</Label>
        <Input id="account-name" value={name} onChange={(e) => onName(e.target.value)} autoFocus />
      </div>
      <div className="rounded-lg border border-dashed px-3 py-2">
        <div className="text-[11px] text-muted-foreground uppercase">{t.manage.loginPreview}</div>
        <div className="flex h-7 items-center font-mono text-base font-semibold" data-testid="login-preview">
          {!name.trim() ? <span className="text-muted-foreground">—</span>
            : suggestion.isFetching || debounced !== name ? <Loader2 className="size-4 animate-spin text-muted-foreground" />
            : suggestion.data ?? '—'}
        </div>
        <p className="text-xs text-muted-foreground">{t.manage.loginPreviewHint}</p>
      </div>
      <PasswordWithGenerate id="account-password" value={password} onChange={onPassword} />
    </>
  )
}

/** Destructive confirmation; runs `onConfirm`, toasts errors. */
export function ConfirmDialog({
  open, onOpenChange, title, description, confirmLabel, onConfirm,
}: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description: string; confirmLabel: string; onConfirm: () => Promise<unknown> }) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t.common.cancel}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={async (e) => {
              e.preventDefault()
              setBusy(true)
              try { await onConfirm(); onOpenChange(false) } catch (err) { toast.error(errorMessage(err)) } finally { setBusy(false) }
            }}
          >
            {busy && <Loader2 className="animate-spin" />} {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * Generic form dialog: renders `children` as fields, submits via `onSubmit`.
 * Server errors are shown inline (they're usually things like duplicate_name).
 */
export function FormDialog({
  open, onOpenChange, title, description, submitLabel, onSubmit, canSubmit = true, children,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string
  submitLabel: string; onSubmit: () => Promise<unknown>; canSubmit?: boolean; children: ReactNode
}) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { if (open) setError(null) }, [open])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try { await onSubmit(); onOpenChange(false) } catch (err) { setError(errorMessage(err)) } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {children}
          {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{t.common.cancel}</Button>
            <Button type="submit" disabled={busy || !canSubmit}>{busy && <Loader2 className="animate-spin" />} {submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
