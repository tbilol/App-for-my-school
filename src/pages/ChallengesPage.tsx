import { ListChecks } from 'lucide-react'
import { useT } from '@/i18n'
import { PlaceholderPage } from './PlaceholderPage'

export default function ChallengesPage() {
  const t = useT()
  return <PlaceholderPage title={t.nav.challenges} icon={ListChecks} />
}
