import { Backpack, HeartHandshake, Presentation, type LucideIcon } from 'lucide-react'

export type LoginRole = 'student' | 'teacher' | 'parent'

/** Per-role look for the landing buttons and login screens (tokens in index.css). */
export const roleTheme: Record<LoginRole, { icon: LucideIcon; solid: string; soft: string; text: string; ring: string; hoverText: string }> = {
  student: { icon: Backpack, solid: 'bg-role-student', soft: 'bg-role-student-soft', text: 'text-role-student', ring: 'hover:border-role-student/40', hoverText: 'group-hover:text-role-student' },
  teacher: { icon: Presentation, solid: 'bg-role-teacher', soft: 'bg-role-teacher-soft', text: 'text-role-teacher', ring: 'hover:border-role-teacher/40', hoverText: 'group-hover:text-role-teacher' },
  parent: { icon: HeartHandshake, solid: 'bg-role-parent', soft: 'bg-role-parent-soft', text: 'text-role-parent', ring: 'hover:border-role-parent/40', hoverText: 'group-hover:text-role-parent' },
}
