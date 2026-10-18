import { MessagesSquare } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/features/school/components'
import { useT } from '@/i18n'
import { useConversations } from './api'
import { ConversationList, ThreadView } from './components'

const LIST = '/teacher?tab=messages'

/** Teacher panel → Xabarlar: threads with parents, by student; `conversationId` opens one. */
export function TeacherMessages({ conversationId }: { conversationId: string | null }) {
  const t = useT()
  const all = useConversations()

  if (all.isPending) return <Skeleton className="h-64 rounded-2xl" />
  if (all.isError) return <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{t.messages.loadError}</p>

  const conv = conversationId ? all.data.find((c) => c.id === conversationId) : undefined
  if (conv) return <div className="mx-auto max-w-2xl"><ThreadView conversation={conv} perspective="teacher" backTo={LIST} /></div>

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <p className="text-sm text-muted-foreground">{t.messages.teacherSubtitle}</p>
      <section className="overflow-hidden rounded-2xl border bg-card">
        {!all.data.length ? <EmptyState icon={MessagesSquare} text={t.messages.empty} /> : (
          <ConversationList list={all.data} perspective="teacher" hrefOf={(c) => `${LIST}&c=${c.id}`} />
        )}
      </section>
      <p className="px-1 text-xs text-muted-foreground">{t.messages.startHint}</p>
    </div>
  )
}
