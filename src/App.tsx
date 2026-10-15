import { Suspense } from 'react'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { FullPageSpinner } from '@/components/FullPageSpinner'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { isSupabaseConfigured } from '@/lib/supabase'
import { router } from '@/router'
import { SetupScreen } from '@/pages/SetupScreen'

export default function App() {
  if (!isSupabaseConfigured) return <SetupScreen />
  return (
    <AuthProvider>
      {/* catches the lazy parent/admin layouts; pages have their own boundaries inside layouts */}
      <Suspense fallback={<FullPageSpinner />}>
        <RouterProvider router={router} />
      </Suspense>
      <Toaster position="top-center" richColors />
    </AuthProvider>
  )
}
