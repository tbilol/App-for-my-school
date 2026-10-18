import type { UserRole } from '@/types/models'

/** Where each role lands after sign-in. Admin and parents have their own apps. */
export function roleHome(role: UserRole | undefined) {
  switch (role) {
    case 'admin': return '/admin'
    case 'super_admin': return '/admin'
    case 'parent': return '/parent'
    case 'teacher': return '/teacher'
    default: return '/'
  }
}
