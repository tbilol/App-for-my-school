import { PageHeader } from '@/components/PageHeader'
import { AnnouncementsFeed } from '@/features/school/AnnouncementsFeed'
import { useT } from '@/i18n'

export default function AdminAnnouncementsPage() {
  const t = useT()
  return (<><PageHeader title={t.announcementsPage.title} description={t.announcementsPage.subtitle} /><AnnouncementsFeed /></>)
}
