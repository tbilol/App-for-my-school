import { lazy } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { RedirectIfAuthed, RequireAuth, RequireRole } from '@/features/auth/guards'
import NotFoundPage from '@/pages/NotFoundPage'
import LandingPage from '@/pages/onboarding/LandingPage'
import LoginFormPage from '@/pages/onboarding/LoginFormPage'

// Signed-in apps are code-split: a student never downloads the admin app and vice versa.
const HomePage = lazy(() => import('@/pages/HomePage'))
const ChallengesPage = lazy(() => import('@/pages/ChallengesPage'))
const ShopPage = lazy(() => import('@/pages/ShopPage'))
const RatingsPage = lazy(() => import('@/pages/RatingsPage'))
const ProfilePage = lazy(() => import('@/pages/ProfilePage'))
const EventsPage = lazy(() => import('@/pages/EventsPage'))
const AnnouncementsPage = lazy(() => import('@/pages/AnnouncementsPage'))
const TeacherPanel = lazy(() => import('@/pages/TeacherPanel'))
const ParentLayout = lazy(() => import('@/components/layout/ParentLayout').then((m) => ({ default: m.ParentLayout })))
const ParentHome = lazy(() => import('@/pages/parent/ParentHome'))
const AdminLayout = lazy(() => import('@/components/layout/AdminLayout').then((m) => ({ default: m.AdminLayout })))
const AdminClassesPage = lazy(() => import('@/pages/admin/AdminClassesPage'))
const AdminTeachersPage = lazy(() => import('@/pages/admin/AdminTeachersPage'))
const AdminStudentsPage = lazy(() => import('@/pages/admin/AdminStudentsPage'))
const AdminParentsPage = lazy(() => import('@/pages/admin/AdminParentsPage'))
const AdminSettingsPage = lazy(() => import('@/pages/admin/AdminSettingsPage'))
const AdminShopPage = lazy(() => import('@/pages/admin/AdminShopPage'))
const AdminOrdersPage = lazy(() => import('@/pages/admin/AdminOrdersPage'))
const AdminAchievementsPage = lazy(() => import('@/pages/admin/AdminAchievementsPage'))
const AdminEventsPage = lazy(() => import('@/pages/admin/AdminEventsPage'))
const AdminAnnouncementsPage = lazy(() => import('@/pages/admin/AdminAnnouncementsPage'))
const AdminEconomyPage = lazy(() => import('@/pages/admin/AdminEconomyPage'))

export const router = createBrowserRouter([
  // ── Onboarding (signed-out only)
  {
    element: <RedirectIfAuthed />,
    children: [
      { path: '/welcome', element: <LandingPage /> },
      { path: '/login', element: <Navigate to="/welcome" replace /> },
      // Any form accepts any account; the profile's role decides where it lands.
      { path: '/login/student', element: <LoginFormPage role="student" /> },
      { path: '/login/teacher', element: <LoginFormPage role="teacher" /> },
      { path: '/login/parent', element: <LoginFormPage role="parent" /> },
      { path: '/login/*', element: <Navigate to="/welcome" replace /> },
    ],
  },

  // ── Signed-in apps, one per role family
  {
    element: <RequireAuth />,
    children: [
      {
        element: <RequireRole roles={['student', 'teacher']} />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <HomePage /> },
              { path: 'challenges', element: <ChallengesPage /> },
              { path: 'shop', element: <ShopPage /> },
              { path: 'ratings', element: <RatingsPage /> },
              { path: 'profile', element: <ProfilePage /> },
              // Achievements now live in Profile → Yutuqlar; keep old links working.
              { path: 'achievements', element: <Navigate to="/profile?tab=achievements" replace /> },
              { path: 'events', element: <EventsPage /> },
              { path: 'announcements', element: <AnnouncementsPage /> },
              {
                element: <RequireRole roles={['teacher']} />,
                children: [{ path: 'teacher/*', element: <TeacherPanel /> }],
              },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
      {
        element: <RequireRole roles={['parent']} />,
        children: [
          { path: '/parent', element: <ParentLayout />, children: [{ index: true, element: <ParentHome /> }] },
        ],
      },
      {
        element: <RequireRole roles={['admin']} />,
        children: [
          {
            path: '/admin',
            element: <AdminLayout />,
            children: [
              { index: true, element: <Navigate to="classes" replace /> },
              { path: 'classes', element: <AdminClassesPage /> },
              { path: 'teachers', element: <AdminTeachersPage /> },
              { path: 'students', element: <AdminStudentsPage /> },
              { path: 'parents', element: <AdminParentsPage /> },
              { path: 'shop', element: <AdminShopPage /> },
              { path: 'orders', element: <AdminOrdersPage /> },
              { path: 'achievements', element: <AdminAchievementsPage /> },
              { path: 'events', element: <AdminEventsPage /> },
              { path: 'announcements', element: <AdminAnnouncementsPage /> },
              { path: 'economy', element: <AdminEconomyPage /> },
              { path: 'settings', element: <AdminSettingsPage /> },
              { path: '*', element: <Navigate to="classes" replace /> },
            ],
          },
        ],
      },
    ],
  },
])
