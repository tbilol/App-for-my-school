import { useQueryClient } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/i18n'
import { useAuth } from './AuthProvider'

export function ProfileErrorScreen() {
  const t = useT()
  const { signOut } = useAuth()
  const queryClient = useQueryClient()

  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="max-w-sm text-center">
        <AlertCircle className="mx-auto size-10 text-destructive" />
        <p className="mt-4 text-sm text-muted-foreground">{t.auth.profileMissing}</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['profile'] })}>
            {t.common.retry}
          </Button>
          <Button onClick={signOut}>{t.auth.signOut}</Button>
        </div>
      </div>
    </div>
  )
}
