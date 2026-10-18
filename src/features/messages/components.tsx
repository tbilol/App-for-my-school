import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, FileText, Loader2, Lock, MessageSquare, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { UserAvatar } from '@/components/UserAvatar'
import { useAuth } from '@/features/auth/AuthProvider'
import { errorMessage } from '@/lib/errors'
import { cn, formatDate } from '@/lib/utils'
import { fmt, useT } from '@/i18n'
import type { ConversationSummary, Message, MessageKind } from '@/types/models'
import { useMarkRead, useSendMessage, useThread } from './api'

const pad = (n: number) => String(n).padStart(2, '0')
const hhmm = (iso: string) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }
const dayKey = (iso: string) => new Date(iso).toDateString()

/** "14:05" today, "Kecha" yesterday, else the date. */
function shortWhen(iso: string, t: ReturnType<typeof useT>) {
  const d = new Date(iso), now = new Date()
  if (d.toDateString() === now.toDateString()) return hhmm(iso)
  const y = new Date(now); y.setDate(now.getDate() - 1)
  return d.toDateString() === y.toDateString() ? t.messages.yesterday : formatDate(iso)
}

export function UnreadBadge({ n, className }: { n: number; className?: string }) {
  const t = useT()
  if (n <= 0) return null
  return (
    <span className={cn('inline-grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-white tabular', className)}
      aria-label={fmt(t.messages.unread, { n })} data-testid="unread-badge">
      {n > 99 ? '99+' : n}
    </span>
  )
}

/**
 * One row per thread. `perspective` decides the name shown: a parent sees the
 * teacher, a teacher sees the student (and their class).
 */
export function ConversationList({ list, perspective, hrefOf }: {
  list: ConversationSummary[]; perspective: 'parent' | 'teacher'; hrefOf: (c: ConversationSummary) => string
}) {
  const t = useT()
  const { profile } = useAuth()
  return (
    <ul className="divide-y" data-testid="conversation-list">
      {list.map((c) => {
        const name = perspective === 'parent' ? c.teacher_name : c.student_name
        const sub = perspective === 'parent' ? c.student_name : [c.class_name, c.guardians.map((g) => g.full_name).join(', ')].filter(Boolean).join(' · ')
        const mine = c.last_sender_id === profile?.id
        const preview = c.last_body == null ? t.messages.noMessagesYet
          : `${mine ? t.messages.you + ': ' : ''}${c.last_kind === 'report' ? `📋 ${c.last_title ?? t.messages.report}: ` : ''}${c.last_body}`
        return (
          <li key={c.id}>
            <Link to={hrefOf(c)} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/60" data-testid={`conv-${c.id}`}>
              <UserAvatar name={name} className="size-10" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className={cn('min-w-0 flex-1 truncate text-sm', c.unread > 0 ? 'font-bold' : 'font-semibold')}>{name}</span>
                  {c.last_message_at && <span className="shrink-0 text-[11px] text-muted-foreground tabular">{shortWhen(c.last_message_at, t)}</span>}
                </div>
                {sub && <div className="truncate text-xs text-muted-foreground">{sub}</div>}
                <div className="mt-0.5 flex items-center gap-2">
                  <span className={cn('min-w-0 flex-1 truncate text-sm', c.unread > 0 ? 'font-medium text-foreground' : 'text-muted-foreground')}>{preview}</span>
                  <UnreadBadge n={c.unread} />
                </div>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function ReportCard({ m, sender, mine }: { m: Message; sender: string; mine: boolean }) {
  const t = useT()
  return (
    <article className="rounded-2xl border-2 border-primary/25 bg-primary-soft/60 p-4 shadow-xs" data-testid="report-card">
      <div className="flex items-center gap-2 text-xs font-semibold text-primary">
        <span className="grid size-6 place-items-center rounded-lg bg-primary text-primary-foreground"><FileText className="size-3.5" /></span>
        {t.messages.report}
        <span className="ml-auto font-normal text-muted-foreground tabular">{hhmm(m.created_at)}</span>
      </div>
      {m.title && <h3 className="mt-2 text-base font-semibold">{m.title}</h3>}
      <p className="mt-1.5 text-sm leading-relaxed break-words whitespace-pre-wrap">{m.body}</p>
      <div className="mt-2 text-xs text-muted-foreground">{mine ? t.messages.you : fmt(t.messages.reportFrom, { name: sender })}</div>
    </article>
  )
}

function Bubble({ m, sender, mine, showName }: { m: Message; sender: string; mine: boolean; showName: boolean }) {
  return (
    <div className={cn('flex flex-col', mine ? 'items-end' : 'items-start')} data-testid={mine ? 'bubble-mine' : 'bubble-other'}>
      {showName && <span className="mb-0.5 px-1 text-xs font-medium text-muted-foreground">{sender}</span>}
      <div className={cn('max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-xs sm:max-w-[75%]',
        mine ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md border bg-card')}>
        <p className="leading-relaxed break-words whitespace-pre-wrap">{m.body}</p>
        <div className={cn('mt-0.5 text-right text-[10px] tabular', mine ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{hhmm(m.created_at)}</div>
      </div>
    </div>
  )
}

/** Compose box. Teachers can switch to a report (optional title). */
function Composer({ conversationId, canReport }: { conversationId: string; canReport: boolean }) {
  const t = useT()
  const send = useSendMessage(conversationId)
  const [kind, setKind] = useState<MessageKind>('message')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!body.trim() || send.isPending) return
    send.mutate({ body, kind, title: kind === 'report' ? title : undefined }, {
      onSuccess: () => {
        setBody(''); setTitle('')
        if (kind === 'report') { toast.success(t.messages.reportSent); setKind('message') }
      },
      onError: (err) => toast.error(errorMessage(err)),
    })
  }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit()
  }
  const report = kind === 'report'

  return (
    <form onSubmit={submit} className={cn('rounded-2xl border bg-card p-3 shadow-xs', report && 'border-primary/40 ring-2 ring-primary/10')} data-testid="composer">
      {canReport && (
        <div className="mb-2 flex gap-1" role="radiogroup" aria-label={t.messages.sendReport}>
          {(['message', 'report'] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
              className={cn('flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                kind === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary')}>
              {k === 'message' ? <MessageSquare className="size-3.5" /> : <FileText className="size-3.5" />}
              {k === 'message' ? t.messages.kindMessage : t.messages.kindReport}
            </button>
          ))}
        </div>
      )}
      {report && (
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className="mb-2"
          aria-label={t.messages.reportTitle} placeholder={t.messages.reportTitlePlaceholder} />
      )}
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={onKey} maxLength={4000}
        rows={report ? 5 : 2} className="max-h-60 resize-none border-0 px-1 shadow-none focus-visible:ring-0"
        aria-label={report ? t.messages.kindReport : t.messages.placeholder}
        placeholder={report ? t.messages.reportPlaceholder : t.messages.placeholder} />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground max-sm:hidden">{t.messages.sendHint}</span>
        <Button type="submit" size="sm" className="ml-auto rounded-xl" disabled={!body.trim() || send.isPending}>
          {send.isPending ? <Loader2 className="animate-spin" /> : report ? <FileText /> : <Send />}
          {report ? t.messages.sendReport : t.messages.send}
        </Button>
      </div>
    </form>
  )
}

/**
 * A thread: header, day-separated messages (reports as cards, others as
 * bubbles; mine on the right), composer. Marks the thread read on open and
 * whenever new messages arrive while it's open.
 */
export function ThreadView({ conversation, perspective, backTo }: {
  conversation: ConversationSummary; perspective: 'parent' | 'teacher'; backTo: string
}) {
  const t = useT()
  const { profile } = useAuth()
  const thread = useThread(conversation.id)
  const markRead = useMarkRead()
  const endRef = useRef<HTMLDivElement>(null)
  const count = thread.data?.length ?? 0
  const lastId = thread.data?.at(-1)?.id

  const { mutate: mark } = markRead
  useEffect(() => { if (thread.isSuccess) mark(conversation.id) }, [conversation.id, lastId, thread.isSuccess, mark])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [count])

  const nameOf = useMemo(() => {
    const names = new Map<string, string>([[conversation.teacher_id, conversation.teacher_name]])
    for (const g of conversation.guardians) names.set(g.id, g.full_name)
    return (id: string) => (id === profile?.id ? t.messages.you : names.get(id) ?? t.messages.guardian)
  }, [conversation, profile?.id, t])

  const title = perspective === 'parent' ? conversation.teacher_name : conversation.student_name
  const subtitle = perspective === 'parent'
    ? fmt(t.messages.parentOf, { name: conversation.student_name })
    : conversation.guardians.length
      ? fmt(t.messages.guardians, { names: conversation.guardians.map((g) => g.full_name).join(', ') })
      : t.messages.noGuardians

  return (
    <div className="space-y-4" data-testid="thread">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="-ml-2 shrink-0"><Link to={backTo} aria-label={t.messages.back}><ChevronLeft /></Link></Button>
        <UserAvatar name={title} className="size-10" />
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold">{title}{perspective === 'teacher' && conversation.class_name ? <span className="font-normal text-muted-foreground"> · {conversation.class_name}</span> : null}</h1>
          <p className={cn('truncate text-xs', !conversation.guardians.length && perspective === 'teacher' ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground')}>{subtitle}</p>
        </div>
      </div>

      <div className="space-y-2.5" data-testid="thread-messages" aria-live="polite">
        {thread.isPending ? <Skeleton className="h-48 rounded-2xl" /> : thread.isError ? (
          <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{t.messages.loadError}</p>
        ) : !count ? (
          <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">{t.messages.noMessagesYet}</p>
        ) : thread.data!.map((m, i) => {
          const prev = thread.data![i - 1]
          const newDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at)
          const mine = m.sender_id === profile?.id
          return (
            <div key={m.id} className="space-y-2.5">
              {newDay && (
                <div className="flex justify-center pt-1">
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {dayKey(m.created_at) === new Date().toDateString() ? t.messages.today : formatDate(m.created_at)}
                  </span>
                </div>
              )}
              {m.kind === 'report'
                ? <ReportCard m={m} sender={nameOf(m.sender_id)} mine={mine} />
                : <Bubble m={m} sender={nameOf(m.sender_id)} mine={mine}
                    showName={!mine && (newDay || !prev || prev.sender_id !== m.sender_id || prev.kind === 'report')} />}
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      {conversation.open ? (
        <Composer conversationId={conversation.id} canReport={perspective === 'teacher'} />
      ) : (
        <p className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground" data-testid="thread-closed">
          <Lock className="size-4 shrink-0" /> {t.messages.closed}
        </p>
      )}
    </div>
  )
}
