import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useT } from '@/i18n'

export default function NotFoundPage() {
  const t = useT()
  return (
    <div className="grid place-items-center py-24 text-center">
      <p className="text-6xl font-bold text-primary tabular">404</p>
      <h1 className="mt-3 text-lg font-semibold">{t.notFound.title}</h1>
      <Button asChild className="mt-6"><Link to="/">{t.notFound.back}</Link></Button>
    </div>
  )
}
