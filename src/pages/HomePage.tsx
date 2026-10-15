import { House } from 'lucide-react'
import { useT } from '@/i18n'
import { PlaceholderPage } from './PlaceholderPage'

export default function HomePage() {
  const t = useT()
  return <PlaceholderPage title={t.nav.home} icon={House} />
}
