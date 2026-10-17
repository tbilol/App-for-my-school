import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import type { ClassRow, Profile } from '@/types/models'

// Data layer for roster/parent/teacher management. Every read is narrowed by
// RLS on the server (teachers only get their classes); the filters here are
// for shaping, not security.

export type Member = Pick<Profile, 'id' | 'full_name' | 'role' | 'class_id' | 'coin_balance' | 'login'>
const MEMBER_COLS = 'id, full_name, role, class_id, coin_balance, login'

async function rows<T>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p
  if (error) throw new Error(error.message)
  return data as T
}

export const manageKeys = {
  classes: ['manage', 'classes'] as const,
  students: ['manage', 'students'] as const,
  parents: ['manage', 'parents'] as const,
  teachers: ['manage', 'teachers'] as const,
  admins: ['manage', 'admins'] as const,
  assignments: ['manage', 'assignments'] as const,
}

/** Classes the caller may manage: all for admin, assigned ones for teachers. */
export function useManagedClasses() {
  const { profile, hasRole } = useAuth()
  const isAdmin = hasRole('admin', 'super_admin')
  return useQuery({
    queryKey: [...manageKeys.classes, profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      if (isAdmin) return rows<ClassRow[]>(supabase.from('classes').select('id, name, grade').order('grade').order('name'))
      const data = await rows<{ class: ClassRow }[]>(
        supabase.from('teacher_classes').select('class:classes(id, name, grade)').eq('teacher_id', profile!.id),
      )
      return data.map((r) => r.class).sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name))
    },
  })
}

/** All students visible to the caller (RLS-scoped), sorted by name. */
export function useStudents() {
  return useQuery({
    queryKey: manageKeys.students,
    queryFn: () => rows<Member[]>(supabase.from('profiles').select(MEMBER_COLS).eq('role', 'student').order('full_name')),
  })
}

export interface ParentWithChildren extends Member { childIds: string[] }

/** Parents visible to the caller with their linked children (joined client-side). */
export function useParents() {
  return useQuery({
    queryKey: manageKeys.parents,
    queryFn: async () => {
      const [parents, links] = await Promise.all([
        rows<Member[]>(supabase.from('profiles').select(MEMBER_COLS).eq('role', 'parent').order('full_name')),
        rows<{ parent_id: string; student_id: string }[]>(supabase.from('parent_links').select('parent_id, student_id')),
      ])
      return parents.map<ParentWithChildren>((p) => ({
        ...p,
        childIds: links.filter((l) => l.parent_id === p.id).map((l) => l.student_id),
      }))
    },
  })
}

export function useTeachers() {
  return useQuery({
    queryKey: manageKeys.teachers,
    queryFn: () => rows<Member[]>(supabase.from('profiles').select(MEMBER_COLS).eq('role', 'teacher').order('full_name')),
  })
}

/** Super admin: every admin-tier account (RLS: staff read all profiles). */
export function useAdmins() {
  return useQuery({
    queryKey: manageKeys.admins,
    queryFn: () => rows<Member[]>(supabase.from('profiles').select(MEMBER_COLS).in('role', ['admin', 'super_admin']).order('full_name')),
  })
}

/** Admin: every teacher↔class assignment. */
export function useAssignments() {
  return useQuery({
    queryKey: manageKeys.assignments,
    queryFn: () => rows<{ teacher_id: string; class_id: string }[]>(supabase.from('teacher_classes').select('teacher_id, class_id')),
  })
}

// ───────── mutations ─────────

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

/** Wraps a mutation so every manage list refreshes afterwards. */
function useManageMutation<A, R>(fn: (a: A) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['manage'] }) })
}

/** What the create RPCs return: the generated login (shown to staff to hand out). */
export interface CreatedAccount { user_id: string; login: string }

export const useAddStudent = () =>
  useManageMutation(async (a: { classId: string; fullName: string; password: string }) =>
    (await rpc<CreatedAccount[]>('add_student', { p_class: a.classId, p_full_name: a.fullName, p_password: a.password }))[0])

export const useCreateTeacher = () =>
  useManageMutation(async (a: { fullName: string; password: string }) =>
    (await rpc<CreatedAccount[]>('create_teacher', { p_full_name: a.fullName, p_password: a.password }))[0])

export const useCreateAdmin = () =>
  useManageMutation(async (a: { fullName: string; password: string }) =>
    (await rpc<CreatedAccount[]>('create_admin', { p_full_name: a.fullName, p_password: a.password }))[0])

export const useCreateParent = () =>
  useManageMutation(async (a: { fullName: string; password: string; studentIds: string[] }) =>
    (await rpc<CreatedAccount[]>('create_parent', { p_full_name: a.fullName, p_password: a.password, p_student_ids: a.studentIds }))[0])

export const useLinkParent = () =>
  useManageMutation((a: { parentId: string; studentId: string }) => rpc<void>('link_parent', { p_parent: a.parentId, p_student: a.studentId }))

export const useUnlinkParent = () =>
  useManageMutation((a: { parentId: string; studentId: string }) => rpc<void>('unlink_parent', { p_parent: a.parentId, p_student: a.studentId }))

export const useUpdateMember = () =>
  useManageMutation((a: { userId: string; fullName?: string; classId?: string }) =>
    rpc<Profile>('update_member', { p_user: a.userId, p_full_name: a.fullName ?? null, p_class_id: a.classId ?? null }))

export const useResetPassword = () =>
  useManageMutation((a: { userId: string; newPassword: string }) =>
    rpc<void>('reset_password', { p_user: a.userId, p_new_password: a.newPassword }))

/**
 * Live preview of the login the server would generate for a name right now.
 * Debounced by the caller; the authoritative login comes back from the create RPC.
 */
export function useSuggestedLogin(fullName: string) {
  const name = fullName.trim().replace(/\s+/g, ' ')
  return useQuery({
    queryKey: ['manage', 'suggest-login', name],
    enabled: name.length > 0,
    staleTime: 0,
    queryFn: () => rpc<string>('suggest_login', { p_full_name: name }),
  })
}

export const useDeleteMember = () => useManageMutation((a: { userId: string }) => rpc<void>('delete_member', { p_user: a.userId }))

export const useCreateClass = () =>
  useManageMutation((a: { name: string; grade: number }) => rpc<ClassRow>('create_class', { p_name: a.name, p_grade: a.grade }))

export const useUpdateClass = () =>
  useManageMutation(async (a: { id: string; name: string; grade: number }) => {
    const { error } = await supabase.from('classes').update({ name: a.name.trim(), grade: a.grade }).eq('id', a.id)
    if (error) throw new Error(error.code === '23505' ? 'duplicate_name' : error.message)
  })

export const useDeleteClass = () =>
  useManageMutation(async (a: { id: string }) => {
    const { error } = await supabase.from('classes').delete().eq('id', a.id)
    if (error) throw new Error(error.message)
  })

export const useSetTeacherClasses = () =>
  useManageMutation((a: { teacherId: string; classIds: string[] }) =>
    rpc<void>('set_teacher_classes', { p_teacher: a.teacherId, p_class_ids: a.classIds }))
