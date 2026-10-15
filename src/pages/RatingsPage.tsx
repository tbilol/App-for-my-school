import { Trophy } from 'lucide-react'
import { useT } from '@/i18n'
import { PlaceholderPage } from './PlaceholderPage'

export default function RatingsPage() {
  const t = useT()
  return <PlaceholderPage title={t.nav.ratings} icon={Trophy} />
}
