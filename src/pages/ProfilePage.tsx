import { User } from 'lucide-react'
import { useT } from '@/i18n'
import { PlaceholderPage } from './PlaceholderPage'

export default function ProfilePage() {
  const t = useT()
  return <PlaceholderPage title={t.nav.profile} icon={User} />
}
