import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSelectedChild } from '@/components/layout/ParentLayout'
import { AnnouncementsFeed } from '@/features/school/AnnouncementsFeed'
import { EventsList } from '@/features/school/EventsList'
import { fmt, useT } from '@/i18n'

/** Read-only school news for parents: announcements + events (badged with the selected child's results). */
export default function ParentSchoolPage() {
  const t = useT()
  const child = useSelectedChild()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'events' ? 'events' : 'announcements'

  return (
    <div>
      <PageHeader title={t.parent.schoolTitle} description={t.parent.schoolSubtitle} back={{ to: '/parent', label: t.parent.navOverview }} />
      <Tabs value={tab} onValueChange={(v) => setParams(v === 'events' ? { tab: 'events' } : {}, { replace: true })}>
        <TabsList className="mb-4">
          <TabsTrigger value="announcements">{t.announcementsPage.title}</TabsTrigger>
          <TabsTrigger value="events">{t.eventsPage.title}</TabsTrigger>
        </TabsList>
        {/* AnnouncementsFeed shows post/delete controls to staff only — parents just read */}
        <TabsContent value="announcements"><AnnouncementsFeed /></TabsContent>
        <TabsContent value="events">
          <EventsList resultsFor={child.id} resultLabel={fmt(t.parent.childResult, { name: child.full_name.split(' ')[0] })} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
