import { ShieldCheck } from 'lucide-react'
import { useT } from '@/i18n'
import { PlaceholderPage } from './PlaceholderPage'

export default function AdminPanel() {
  const t = useT()
  return <PlaceholderPage title={t.nav.admin} icon={ShieldCheck} />
}
