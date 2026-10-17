import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordField } from '@/components/PasswordField'
import { useAuth } from '@/features/auth/AuthProvider'
import { errorMessage } from '@/lib/errors'
import { useT } from '@/i18n'

/**
 * The one login screen for every role (students, teachers, parents, admins).
 * Supabase Auth checks the credentials; where the user lands is decided by the
 * role on their profile (RedirectIfAuthed → roleHome). The client knows no
 * account names or roles.
 */
export default function LandingPage() {
  const t = useT()
  const { signInLogin } = useAuth()
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
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-5 pt-[calc(2rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <img src="/logo-crest-384.png" alt={t.app.school} className="size-28 sm:size-36" width={144} height={144} />
          <h1 className="mt-6 text-2xl font-bold tracking-tight">{t.onboarding.landingTitle}</h1>
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
          <Button type="submit" className="h-12 w-full" disabled={busy || !login.trim() || !password}>
            {busy && <Loader2 className="animate-spin" />} {t.auth.signIn}
          </Button>
        </form>
      </div>
    </div>
  )
}
