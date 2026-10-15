import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordField } from '@/components/PasswordField'
import { useAuth } from '@/features/auth/AuthProvider'
import { errorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'
import { roleTheme, type LoginRole } from './roleTheme'

/**
 * One login + password form per landing button. Supabase Auth checks the
 * credentials; where the user lands is decided by the role on their profile
 * (RedirectIfAuthed → roleHome), not by which button they pressed. The client
 * knows no account names or roles.
 */
export default function LoginFormPage({ role }: { role: LoginRole }) {
  const t = useT()
  const { signInLogin } = useAuth()
  const theme = roleTheme[role]
  const Icon = theme.icon
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signInLogin(login, password)
    } catch (err) {
      // One message for every failure, so the form reveals nothing about which logins exist.
      setError(err instanceof Error && err.message === 'invalid_credentials' ? t.auth.invalidLogin : errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex h-11 items-center">
          <Link to="/welcome" className="-ml-2 flex items-center gap-1 rounded-lg px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
            <ChevronLeft className="size-4" /> {t.onboarding.back}
          </Link>
        </div>

        <div className="mt-4 flex flex-col items-center text-center">
          <div className="relative">
            <img src="/logo-crest-384.png" alt={t.app.school} className="size-20" width={80} height={80} />
            <span className={cn('absolute -right-2 -bottom-1 grid size-9 place-items-center rounded-full text-white ring-4 ring-background', theme.solid)}>
              <Icon className="size-4.5" />
            </span>
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight">{t.onboarding.loginTitles[role]}</h1>
          <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">{t.onboarding.loginHint}</p>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="login">{t.onboarding.login}</Label>
            <Input
              id="login" value={login} onChange={(e) => setLogin(e.target.value)} autoFocus
              autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username"
              placeholder={t.onboarding.loginPlaceholder} className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t.auth.password}</Label>
            <PasswordField id="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder={t.auth.passwordPlaceholder} />
          </div>
          {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Button type="submit" className={cn('h-12 w-full text-white hover:opacity-90', theme.solid)} disabled={busy || !login.trim() || !password}>
            {busy && <Loader2 className="animate-spin" />} {t.auth.signIn}
          </Button>
        </form>
      </div>
    </div>
  )
}
