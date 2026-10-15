import { PageHeader } from '@/components/PageHeader'
import { AnnouncementsFeed } from '@/features/school/AnnouncementsFeed'
import { useT } from '@/i18n'

export default function AnnouncementsPage() {
  const t = useT()
  return (<><PageHeader title={t.announcementsPage.title} description={t.announcementsPage.subtitle} back={{ to: '/', label: t.eventsPage.backHome }} /><AnnouncementsFeed /></>)
}
