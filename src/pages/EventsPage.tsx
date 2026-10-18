import { PageHeader } from '@/components/PageHeader'
import { useAuth } from '@/features/auth/AuthProvider'
import { EventsList } from '@/features/school/EventsList'
import { useT } from '@/i18n'

export default function EventsPage() {
  const t = useT()
  const { profile } = useAuth()
  return (
    <>
      <PageHeader title={t.eventsPage.title} description={t.eventsPage.subtitle} back={{ to: '/', label: t.eventsPage.backHome }} />
      <EventsList resultsFor={profile?.id} />
    </>
  )
}
