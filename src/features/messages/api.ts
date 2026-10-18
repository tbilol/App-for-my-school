import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import type { ConversationSummary, Message, MessageKind } from '@/types/models'

// Parent ↔ teacher messaging. Reads: messages through RLS (participants only),
// the thread list through list_my_conversations() (it carries names a parent
// can't read from profiles). Writes: RPCs only (20261024000000_messaging.sql).
// No realtime channel: open threads poll, lists refresh on focus/interval.

async function rows<T>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p
  if (error) throw new Error(error.message)
  return data as T
}
async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

export const messageKeys = {
  conversations: ['messages', 'conversations'] as const,
  thread: (id: string) => ['messages', 'thread', id] as const,
  childTeachers: (studentId: string) => ['messages', 'child-teachers', studentId] as const,
}

/** Every thread the caller is in (teacher: own; parent: all their children's), newest activity first. */
export function useConversations() {
  const { profile } = useAuth()
  return useQuery({
    queryKey: messageKeys.conversations,
    enabled: profile?.role === 'teacher' || profile?.role === 'parent',
    refetchInterval: 30_000,
    queryFn: () => rpc<ConversationSummary[]>('list_my_conversations'),
  })
}

/** Total unread across `list` (optionally only one child's threads). */
export function unreadTotal(list: ConversationSummary[] | undefined, studentId?: string) {
  return (list ?? []).filter((c) => !studentId || c.student_id === studentId).reduce((n, c) => n + c.unread, 0)
}

/** The thread's messages, oldest first. Polls while the thread is open. */
export function useThread(conversationId: string | undefined) {
  return useQuery({
    queryKey: messageKeys.thread(conversationId ?? ''),
    enabled: !!conversationId,
    refetchInterval: 10_000,
    queryFn: () => rows<Message[]>(
      supabase.from('messages').select('*').eq('conversation_id', conversationId!).order('created_at').limit(500),
    ),
  })
}

/** Teachers of the parent's child — whom a new thread can be started with. */
export function useChildTeachers(studentId: string) {
  return useQuery({
    queryKey: messageKeys.childTeachers(studentId),
    queryFn: () => rpc<{ teacher_id: string; full_name: string }[]>('list_child_teachers', { p_student: studentId }),
  })
}

/** Get-or-create the (teacher, student) thread; resolves to its id. */
export function useOpenConversation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (a: { teacherId: string; studentId: string }) =>
      (await rpc<{ id: string }>('open_conversation', { p_teacher: a.teacherId, p_student: a.studentId })).id,
    onSuccess: () => qc.invalidateQueries({ queryKey: messageKeys.conversations }),
  })
}

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (a: { body: string; kind?: MessageKind; title?: string }) =>
      rpc<Message>('send_message', { p_conversation: conversationId, p_body: a.body, p_kind: a.kind ?? 'message', p_title: a.title || null }),
    onSuccess: (m) => {
      qc.setQueryData<Message[]>(messageKeys.thread(conversationId), (old) => (old && !old.some((x) => x.id === m.id) ? [...old, m] : old))
      qc.invalidateQueries({ queryKey: messageKeys.conversations })
    },
  })
}

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (conversationId: string) => rpc<null>('mark_conversation_read', { p_conversation: conversationId }),
    onSuccess: (_d, conversationId) => {
      // drop the badge right away; the list refetch confirms it
      qc.setQueryData<ConversationSummary[]>(messageKeys.conversations, (old) => old?.map((c) => (c.id === conversationId ? { ...c, unread: 0 } : c)))
    },
  })
}
