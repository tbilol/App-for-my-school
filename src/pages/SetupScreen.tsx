import { Settings } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { useT } from '@/i18n'

/** Shown when .env has no Supabase credentials. */
export function SetupScreen() {
  const t = useT()
  return (
    <div className="grid min-h-dvh place-items-center bg-primary-soft p-6">
      <div className="w-full max-w-md rounded-xl bg-card p-8 shadow-sm">
        <Logo />
        <h1 className="mt-6 flex items-center gap-2 text-lg font-semibold"><Settings className="size-5 text-primary" /> {t.setup.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t.setup.body}</p>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-muted p-3 text-xs">VITE_SUPABASE_URL=https://…supabase.co{'\n'}VITE_SUPABASE_ANON_KEY=…</pre>
      </div>
    </div>
  )
}
