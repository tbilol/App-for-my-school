import { RouterProvider } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { isSupabaseConfigured } from '@/lib/supabase'
import { router } from '@/router'
import { SetupScreen } from '@/pages/SetupScreen'

export default function App() {
  if (!isSupabaseConfigured) return <SetupScreen />
  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <Toaster position="top-center" richColors />
    </AuthProvider>
  )
}
