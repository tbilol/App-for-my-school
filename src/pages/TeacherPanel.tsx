import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StudentRoster } from '@/features/manage/StudentRoster'
import { ParentsManager } from '@/features/manage/ParentsManager'
import { unreadTotal, useConversations } from '@/features/messages/api'
import { UnreadBadge } from '@/features/messages/components'
import { TeacherMessages } from '@/features/messages/TeacherMessages'
import { useT } from '@/i18n'

const TABS = ['students', 'parents', 'messages'] as const
type Tab = (typeof TABS)[number]

// Coin awarding / submission review arrive in build step 5.
// ?tab=messages&c=<conversation id> deep-links into a thread (used by the roster's "Xabar yozish").
export default function TeacherPanel() {
  const t = useT()
  const [params, setParams] = useSearchParams()
  const tab: Tab = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as Tab) : 'students'
  const conversations = useConversations()
  const unread = unreadTotal(conversations.data)

  return (
    <>
      <PageHeader title={t.nav.teacher} />
      <Tabs value={tab} onValueChange={(v) => setParams(v === 'students' ? {} : { tab: v }, { replace: true })}>
        <TabsList className="mb-4">
          <TabsTrigger value="students">{t.nav.students}</TabsTrigger>
          <TabsTrigger value="parents">{t.nav.parents}</TabsTrigger>
          <TabsTrigger value="messages" className="gap-1.5">{t.messages.title}<UnreadBadge n={unread} className="h-4 min-w-4 px-1 text-[10px]" /></TabsTrigger>
        </TabsList>
        <TabsContent value="students"><StudentRoster /></TabsContent>
        <TabsContent value="parents"><ParentsManager /></TabsContent>
        <TabsContent value="messages"><TeacherMessages conversationId={params.get('c')} /></TabsContent>
      </Tabs>
    </>
  )
}
