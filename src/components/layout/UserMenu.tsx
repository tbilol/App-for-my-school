import { Link } from 'react-router-dom'
import { LogOut, User } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { UserAvatar } from '@/components/UserAvatar'
import { useAuth } from '@/features/auth/AuthProvider'
import { useT } from '@/i18n'
import { panelNav } from './nav-items'

export function UserMenu() {
  const t = useT()
  const { profile, signOut, hasRole } = useAuth()
  if (!profile) return null
  const panels = panelNav.filter((p) => !p.roles || hasRole(...p.roles))

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={t.common.menu}>
        <UserAvatar name={profile.full_name} url={profile.avatar_url} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate font-semibold">{profile.full_name}</div>
          <div className="text-xs text-muted-foreground">{t.roles[profile.role]}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile"><User /> {t.nav.profile}</Link>
        </DropdownMenuItem>
        {panels.map(({ to, label, icon: Icon }) => (
          <DropdownMenuItem key={to} asChild>
            <Link to={to}><Icon /> {label}</Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void signOut()}>
          <LogOut /> {t.auth.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
