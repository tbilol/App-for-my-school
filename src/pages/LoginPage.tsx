import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Logo } from '@/components/Logo'
import { CoinIcon } from '@/components/CoinAmount'
import { useAuth } from '@/features/auth/AuthProvider'
import { errorMessage } from '@/lib/errors'
import { useT } from '@/i18n'

export default function LoginPage() {
  const t = useT()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signIn(email, password)
      // RedirectIfAuthed navigates once the session lands.
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setError(/invalid login credentials/i.test(msg) ? t.auth.invalid : errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-dvh md:grid-cols-2">
      {/* Brand panel — desktop only */}
      <div className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground md:flex md:flex-col md:justify-between">
        <span className="flex items-center gap-2 text-lg font-bold">
          <img src="/logo.svg" alt="" className="size-9 rounded-lg ring-2 ring-white/30" />
          {t.app.name}
        </span>
        <div>
          <h2 className="max-w-md text-4xl leading-tight font-bold">{t.app.tagline}</h2>
          <ul className="mt-8 space-y-3 text-primary-foreground/85">
            {[t.subjects.english, t.subjects.math, t.subjects.it].map((s) => (
              <li key={s} className="flex items-center gap-3"><CoinIcon className="size-5" /> {s}</li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-primary-foreground/70">{t.app.school}</p>
        <div aria-hidden className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full bg-white/10" />
        <div aria-hidden className="pointer-events-none absolute -top-16 right-24 size-48 rounded-full bg-white/5" />
      </div>

      {/* Form */}
      <div className="flex items-center justify-center px-5 py-10 pt-[calc(2.5rem+env(safe-area-inset-top))]">
        <div className="w-full max-w-sm">
          <Logo className="mb-8 md:hidden" />
          <h1 className="text-2xl font-bold tracking-tight">{t.auth.welcome}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.auth.subtitle}</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">{t.auth.email}</Label>
              <Input
                id="email" type="email" inputMode="email" autoComplete="email" required
                placeholder={t.auth.emailPlaceholder} value={email} onChange={(e) => setEmail(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t.auth.password}</Label>
              <Input
                id="password" type="password" autoComplete="current-password" required
                value={password} onChange={(e) => setPassword(e.target.value)} className="h-11"
              />
            </div>
            {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <Button type="submit" className="h-11 w-full" disabled={submitting || !email || !password}>
              {submitting && <Loader2 className="animate-spin" />}
              {submitting ? t.auth.signingIn : t.auth.signIn}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">{t.auth.noAccount}</p>
        </div>
      </div>
    </div>
  )
}
