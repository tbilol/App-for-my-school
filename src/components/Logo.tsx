import { cn } from '@/lib/utils'
import { useT } from '@/i18n'

export function Logo({ className, withText = true }: { className?: string; withText?: boolean }) {
  const t = useT()
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <img src="/logo.svg" alt="" className="size-8 shrink-0" />
      {withText && <span className="text-lg font-bold tracking-tight text-primary">{t.app.name}</span>}
    </span>
  )
}
