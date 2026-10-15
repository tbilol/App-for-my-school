import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?'
}

export function UserAvatar({ name, url, className }: { name: string; url?: string | null; className?: string }) {
  return (
    <Avatar className={cn('size-9', className)}>
      {url && <AvatarImage src={url} alt={name} />}
      <AvatarFallback className="bg-primary-soft text-sm font-semibold text-primary">{initials(name)}</AvatarFallback>
    </Avatar>
  )
}
