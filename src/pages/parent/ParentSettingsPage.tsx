import { PageHeader } from '@/components/PageHeader'
import { UserAvatar } from '@/components/UserAvatar'
import { useAuth } from '@/features/auth/AuthProvider'
import { SettingsSection } from '@/features/profile/SettingsSection'
import { useT } from '@/i18n'

/** The parent's account + settings (theme, sign out) — the phone header has no sign-out button. */
export default function ParentSettingsPage() {
  const t = useT()
  const { profile } = useAuth()
  return (
    <div className="space-y-5">
      <PageHeader title={t.parent.settings} back={{ to: '/parent', label: t.parent.navOverview }} />
      <div className="flex items-center gap-3 rounded-2xl border bg-card p-4">
        <UserAvatar name={profile?.full_name ?? ''} url={profile?.avatar_url} className="size-12" />
        <div className="min-w-0">
          <div className="truncate font-semibold">{profile?.full_name}</div>
          <div className="text-sm text-muted-foreground">{profile && t.roles[profile.role]}{profile?.login ? ` · ${profile.login}` : ''}</div>
        </div>
      </div>
      <SettingsSection />
    </div>
  )
}
