import { PageHeader } from '@/components/PageHeader'
import { StudentRoster } from '@/features/manage/StudentRoster'
import { useT } from '@/i18n'

export default function AdminStudentsPage() {
  const t = useT()
  return (<><PageHeader title={t.nav.students} /><StudentRoster /></>)
}
