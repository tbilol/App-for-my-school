import { useT } from '@/i18n'
import { RoleButton } from './components/RoleButton'

export default function LandingPage() {
  const t = useT()
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-5 pt-[calc(2rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md">
        <img src="/logo-crest-384.png" alt={t.app.school} className="mx-auto size-36 sm:size-44" width={176} height={176} />
        <h1 className="mt-6 text-center text-2xl font-bold tracking-tight">{t.onboarding.landingTitle}</h1>
        <p className="mt-1 text-center text-muted-foreground">{t.onboarding.landingSubtitle}</p>
        <nav className="mt-8 flex flex-col gap-3" aria-label={t.onboarding.landingSubtitle}>
          <RoleButton role="student" label={t.roles.student} hint={t.onboarding.roleHints.student} />
          <RoleButton role="teacher" label={t.roles.teacher} hint={t.onboarding.roleHints.teacher} />
          <RoleButton role="parent" label={t.roles.parent} hint={t.onboarding.roleHints.parent} />
        </nav>
      </div>
    </div>
  )
}
