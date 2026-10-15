import { PageHeader } from '@/components/PageHeader'
import { ParentsManager } from '@/features/manage/ParentsManager'
import { useT } from '@/i18n'

export default function AdminParentsPage() {
  const t = useT()
  return (<><PageHeader title={t.nav.parents} /><ParentsManager /></>)
}
