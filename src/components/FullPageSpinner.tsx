import { Loader2 } from 'lucide-react'
import { useT } from '@/i18n'

export function FullPageSpinner() {
  const t = useT()
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-label={t.common.loading}>
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  )
}
