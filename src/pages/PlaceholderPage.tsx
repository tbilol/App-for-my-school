import type { LucideIcon } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { useT } from '@/i18n'

/** Temporary body for pages built in steps 4–5. */
export function PlaceholderPage({ title, icon: Icon }: { title: string; icon: LucideIcon }) {
  const t = useT()
  return (
    <>
      <PageHeader title={title} />
      <div className="grid place-items-center rounded-xl border border-dashed bg-muted py-20 text-center">
        <Icon className="size-10 text-primary/60" />
        <p className="mt-3 text-sm text-muted-foreground">{t.common.comingSoon}</p>
      </div>
    </>
  )
}
