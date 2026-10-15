import { useEffect, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/PageHeader'
import { supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/errors'
import { useT } from '@/i18n'
import type { AuthSettings } from '@/types/models'

const KEY = ['admin', 'config', 'auth'] as const

/** app_config.auth — readable and writable by admin only (RLS). */
export default function AdminSettingsPage() {
  const t = useT()
  const qc = useQueryClient()
  const { data, isPending } = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('app_config').select('value').eq('key', 'auth').single()
      if (error) throw error
      return data.value as AuthSettings
    },
  })
  const [minLength, setMinLength] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (data) setMinLength(String(data.min_password_length)) }, [data])

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const value: AuthSettings = { min_password_length: Math.max(6, Number(minLength) || 6) }
      const { error } = await supabase.from('app_config').update({ value, updated_at: new Date().toISOString() }).eq('key', 'auth')
      if (error) throw error
      await qc.invalidateQueries({ queryKey: KEY })
      toast.success(t.common.saved)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title={t.nav.settings} />
      <form onSubmit={save} className="max-w-lg space-y-5 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">{t.admin.authSettings}</h2>
        {isPending ? <Skeleton className="h-24" /> : (
          <>
            <div className="space-y-2">
              <Label htmlFor="min-len">{t.admin.minPasswordLength}</Label>
              <Input id="min-len" className="w-24" inputMode="numeric" value={minLength} onChange={(e) => setMinLength(e.target.value.replace(/\D/g, '').slice(0, 2))} />
              <p className="text-xs text-muted-foreground">{t.admin.minPasswordHint}</p>
            </div>
            <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />} {t.common.save}</Button>
          </>
        )}
      </form>
    </>
  )
}
