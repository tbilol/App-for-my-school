import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Loader2, MessageSquarePlus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/PageHeader'
import { UserAvatar } from '@/components/UserAvatar'
import { useSelectedChild } from '@/components/layout/ParentLayout'
import { useChildTeachers, useConversations, useOpenConversation } from '@/features/messages/api'
import { ConversationList, ThreadView } from '@/features/messages/components'
import { EmptyState, SectionCard } from '@/features/school/components'
import { errorMessage } from '@/lib/errors'
import { useT } from '@/i18n'

/** The selected child's threads, plus the child's teachers to start a new one. `/parent/messages/:id` opens a thread. */
export default function ParentMessagesPage() {
  const t = useT()
  const child = useSelectedChild()
  const { id } = useParams()
  const navigate = useNavigate()
  const all = useConversations()
  const teachers = useChildTeachers(child.id)
  const open = useOpenConversation()
  const mine = (all.data ?? []).filter((c) => c.student_id === child.id)

  if (id) {
    if (all.isPending) return <Skeleton className="h-96 rounded-2xl" />
    const conv = mine.find((c) => c.id === id)
    // another child's (switcher changed) or not ours → back to the list
    if (!conv) return <Navigate to="/parent/messages" replace />
    return <ThreadView conversation={conv} perspective="parent" backTo="/parent/messages" />
  }

  const withThread = new Set(mine.map((c) => c.teacher_id))
  const others = (teachers.data ?? []).filter((x) => !withThread.has(x.teacher_id))
  const start = (teacherId: string) => open.mutate({ teacherId, studentId: child.id }, {
    onSuccess: (convId) => navigate(`/parent/messages/${convId}`),
    onError: (err) => toast.error(errorMessage(err)),
  })

  return (
    <div className="space-y-4">
      <PageHeader title={t.messages.title} description={t.messages.parentSubtitle} />

      <SectionCard title={child.full_name} className="overflow-hidden rounded-2xl">
        {all.isPending ? <Skeleton className="m-4 h-24" /> : all.isError ? (
          <p className="px-4 py-6 text-center text-sm text-destructive">{t.messages.loadError}</p>
        ) : !mine.length ? <EmptyState icon={MessageSquarePlus} text={t.messages.empty} /> : (
          <ConversationList list={mine} perspective="parent" hrefOf={(c) => `/parent/messages/${c.id}`} />
        )}
      </SectionCard>

      {/* hidden once every teacher already has a thread above */}
      {(teachers.isPending || teachers.isError || others.length > 0 || !teachers.data?.length) && <SectionCard title={t.messages.teachersTitle} className="rounded-2xl">
        {teachers.isPending ? <Skeleton className="m-4 h-16" /> : teachers.isError ? (
          <p className="px-4 py-6 text-center text-sm text-destructive">{errorMessage(teachers.error)}</p>
        ) : !teachers.data?.length ? (
          <EmptyState icon={Users} text={t.messages.noTeachers} />
        ) : (
          <>
            <p className="px-4 pt-3 text-xs text-muted-foreground">{t.messages.teachersHint}</p>
            <ul className="divide-y" data-testid="child-teachers">
              {others.map((x) => (
                <li key={x.teacher_id} className="flex items-center gap-3 px-4 py-2.5">
                  <UserAvatar name={x.full_name} className="size-9" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{x.full_name}</span>
                  <Button size="sm" variant="outline" className="shrink-0" disabled={open.isPending} onClick={() => start(x.teacher_id)}
                    aria-label={`${t.messages.write}: ${x.full_name}`}>
                    {open.isPending && open.variables?.teacherId === x.teacher_id ? <Loader2 className="animate-spin" /> : <MessageSquarePlus />}
                    {t.messages.write}
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </SectionCard>}
    </div>
  )
}
