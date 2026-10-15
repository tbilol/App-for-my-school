import { GraduationCap } from 'lucide-react'
import { useT } from '@/i18n'
import { PlaceholderPage } from './PlaceholderPage'

export default function TeacherPanel() {
  const t = useT()
  return <PlaceholderPage title={t.nav.teacher} icon={GraduationCap} />
}
