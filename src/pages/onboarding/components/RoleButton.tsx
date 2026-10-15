import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { roleTheme, type LoginRole } from '../roleTheme'

export function RoleButton({ role, label, hint }: { role: LoginRole; label: string; hint: string }) {
  const theme = roleTheme[role]
  const Icon = theme.icon
  return (
    <Link
      to={`/login/${role}`}
      className={cn(
        'group flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-xs transition-all focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]',
        theme.ring,
      )}
    >
      <span className={cn('grid size-14 shrink-0 place-items-center rounded-xl text-white', theme.solid)}>
        <Icon className="size-7" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-semibold">{label}</span>
        <span className="block text-sm text-muted-foreground">{hint}</span>
      </span>
      <ChevronRight className={cn('size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5', theme.hoverText)} />
    </Link>
  )
}
