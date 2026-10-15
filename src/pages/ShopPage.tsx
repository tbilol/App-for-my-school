import { ShoppingBag } from 'lucide-react'
import { useT } from '@/i18n'
import { PlaceholderPage } from './PlaceholderPage'

export default function ShopPage() {
  const t = useT()
  return <PlaceholderPage title={t.nav.shop} icon={ShoppingBag} />
}
