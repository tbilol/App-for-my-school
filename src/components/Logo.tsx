import { cn } from '@/lib/utils'
import { useT } from '@/i18n'

/** School crest (downscaled copy of public/logo-crest.png) + app name. */
export function Logo({ className, withText = true }: { className?: string; withText?: boolean }) {
  const t = useT()
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <img src="/logo-crest-384.png" alt={t.app.school} className="size-9 shrink-0" width={36} height={36} />
      {withText && <span className="text-lg font-bold tracking-tight text-primary">{t.app.name}</span>}
    </span>
  )
}
