import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, GraduationCap, Languages, Loader2, LogOut, Moon } from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/features/auth/AuthProvider'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'

function Row({ icon, title, hint, right, tone = 'default' }: {
  icon: ReactNode; title: string; hint?: string; right?: ReactNode; tone?: 'default' | 'danger'
}) {
  return (
    <span className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl',
        tone === 'danger' ? 'bg-destructive/10 text-destructive' : 'bg-primary-soft text-primary')}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm font-medium', tone === 'danger' && 'text-destructive')}>{title}</span>
        {hint && <span className="block truncate text-xs text-muted-foreground">{hint}</span>}
      </span>
      {right}
    </span>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      <div className="divide-y overflow-hidden rounded-2xl border bg-card">{children}</div>
    </section>
  )
}

/** Profil → Sozlamalar: theme (working), language (placeholder), sign-out (working). */
export function SettingsSection() {
  const t = useT()
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const [leaving, setLeaving] = useState(false)

  async function logout() {
    setLeaving(true)
    try {
      await signOut()
      navigate('/welcome', { replace: true })
    } finally {
      setLeaving(false)
    }
  }

  return (
    <div className="space-y-5" data-testid="settings">
      <Group title={t.settings.appearance}>
        <label htmlFor="dark-mode" className="block cursor-pointer hover:bg-muted/50">
          <Row
            icon={<Moon className="size-4.5" />} title={t.settings.darkMode} hint={t.settings.darkModeHint}
            right={<Switch id="dark-mode" checked={theme === 'dark'} onCheckedChange={(on) => setTheme(on ? 'dark' : 'light')} aria-label={t.settings.darkMode} />}
          />
        </label>
        {/* Placeholder: languages are not wired up yet. */}
        <button type="button" className="block w-full hover:bg-muted/50" onClick={() => toast.info(t.settings.soonToast)} data-testid="language-row">
          <Row
            icon={<Languages className="size-4.5" />} title={t.settings.language} hint={t.settings.languageCurrent}
            right={<span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{t.settings.soon}</span>}
          />
        </button>
      </Group>

      <Group title={t.settings.account}>
        {profile?.role === 'teacher' && (
          <Link to="/teacher" className="block hover:bg-muted/50">
            <Row icon={<GraduationCap className="size-4.5" />} title={t.settings.teacherPanel} right={<ChevronRight className="size-4 text-muted-foreground" />} />
          </Link>
        )}
        <button type="button" className="block w-full hover:bg-destructive/5 disabled:opacity-60" onClick={logout} disabled={leaving} data-testid="logout">
          <Row
            tone="danger" icon={leaving ? <Loader2 className="size-4.5 animate-spin" /> : <LogOut className="size-4.5" />}
            title={t.settings.logout} hint={t.settings.logoutHint}
          />
        </button>
      </Group>
    </div>
  )
}
