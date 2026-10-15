import { lazy } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { RedirectIfAuthed, RequireAuth, RequireRole } from '@/features/auth/guards'
import LoginPage from '@/pages/LoginPage'
import NotFoundPage from '@/pages/NotFoundPage'

// Pages are code-split so the phone downloads only what it opens.
const HomePage = lazy(() => import('@/pages/HomePage'))
const ChallengesPage = lazy(() => import('@/pages/ChallengesPage'))
const ShopPage = lazy(() => import('@/pages/ShopPage'))
const RatingsPage = lazy(() => import('@/pages/RatingsPage'))
const ProfilePage = lazy(() => import('@/pages/ProfilePage'))
const TeacherPanel = lazy(() => import('@/pages/TeacherPanel'))
const AdminPanel = lazy(() => import('@/pages/AdminPanel'))

export const router = createBrowserRouter([
  {
    element: <RedirectIfAuthed />,
    children: [{ path: '/login', element: <LoginPage /> }],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'challenges', element: <ChallengesPage /> },
          { path: 'shop', element: <ShopPage /> },
          { path: 'ratings', element: <RatingsPage /> },
          { path: 'profile', element: <ProfilePage /> },
          {
            element: <RequireRole roles={['teacher', 'admin']} />,
            children: [{ path: 'teacher/*', element: <TeacherPanel /> }],
          },
          {
            element: <RequireRole roles={['admin']} />,
            children: [{ path: 'admin/*', element: <AdminPanel /> }],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])
