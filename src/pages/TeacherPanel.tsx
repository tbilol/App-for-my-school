import { PageHeader } from '@/components/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StudentRoster } from '@/features/manage/StudentRoster'
import { ParentsManager } from '@/features/manage/ParentsManager'
import { useT } from '@/i18n'

// Coin awarding / submission review arrive in build step 5.
export default function TeacherPanel() {
  const t = useT()
  return (
    <>
      <PageHeader title={t.nav.teacher} />
      <Tabs defaultValue="students">
        <TabsList className="mb-4">
          <TabsTrigger value="students">{t.nav.students}</TabsTrigger>
          <TabsTrigger value="parents">{t.nav.parents}</TabsTrigger>
        </TabsList>
        <TabsContent value="students"><StudentRoster /></TabsContent>
        <TabsContent value="parents"><ParentsManager /></TabsContent>
      </Tabs>
    </>
  )
}
