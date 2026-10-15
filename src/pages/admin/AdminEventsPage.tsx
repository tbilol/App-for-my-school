import { useMemo, useState } from 'react'
import { CalendarPlus, ListOrdered, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/PageHeader'
import { useAllEvents, useEventResults, useRecordResult, useSaveEvent, type EventInput } from '@/features/admin/api'
import { useStudents } from '@/features/manage/api'
import { FormDialog } from '@/features/manage/dialogs'
import { schoolToday } from '@/features/school/api'
import { errorMessage } from '@/lib/errors'
import { cn, formatCoins, formatDate } from '@/lib/utils'
import { fmt, useT } from '@/i18n'
import type { EventRow, Subject } from '@/types/models'

function ResultsDialog({ ev, onClose }: { ev: EventRow; onClose: () => void }) {
  const t = useT()
  const results = useEventResults(ev.id)
  const students = useStudents()
  const record = useRecordResult()
  const [userId, setUserId] = useState('')
  const [place, setPlace] = useState('participation')
  const [error, setError] = useState<string | null>(null)
  const nameBy = useMemo(() => new Map((students.data ?? []).map((s) => [s.id, s.full_name])), [students.data])
  const taken = new Set((results.data ?? []).map((r) => r.user_id))
  const used = (results.data ?? []).reduce((n, r) => n + r.coins_awarded, 0)

  async function add() {
    setError(null)
    try {
      await record.mutateAsync({ eventId: ev.id, userId, place: place === 'participation' ? null : Number(place) })
      setUserId('')
    } catch (err) { setError(errorMessage(err)) }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.adminEvents.results}: {ev.title}</DialogTitle>
          <DialogDescription>{ev.coins_pool != null ? fmt(t.adminEvents.used, { used: formatCoins(used), pool: formatCoins(ev.coins_pool) }) : formatDate(ev.date)}</DialogDescription>
        </DialogHeader>
        {results.isPending ? <Skeleton className="h-20" /> : !results.data?.length ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t.adminEvents.noResults}</p>
        ) : (
          <ul className="divide-y rounded-lg border" data-testid="event-results">
            {results.data.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="w-16 font-medium">{r.place ? fmt(t.eventsPage.place, { n: r.place }) : t.adminEvents.participation}</span>
                <span className="min-w-0 flex-1 truncate">{nameBy.get(r.user_id) ?? '—'}</span>
                <span className="font-semibold text-success tabular">+{formatCoins(r.coins_awarded)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-2 rounded-lg bg-muted p-3">
          <Label>{t.adminEvents.addResult}</Label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger className="w-full bg-card" aria-label={t.adminEvents.student}><SelectValue placeholder={t.adminEvents.student} /></SelectTrigger>
            <SelectContent>{(students.data ?? []).filter((s) => !taken.has(s.id)).map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name} · {s.login}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex gap-2">
            <Select value={place} onValueChange={setPlace}>
              <SelectTrigger className="flex-1 bg-card" aria-label={t.adminEvents.place}><SelectValue /></SelectTrigger>
              <SelectContent>
                {['1', '2', '3'].map((p) => <SelectItem key={p} value={p}>{fmt(t.eventsPage.place, { n: p })}</SelectItem>)}
                <SelectItem value="participation">{t.adminEvents.participation}</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={add} disabled={!userId || record.isPending}>{t.common.create}</Button>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminEventsPage() {
  const t = useT()
  const events = useAllEvents()
  const save = useSaveEvent()
  const [form, setForm] = useState<EventInput | null>(null)
  const [resultsFor, setResultsFor] = useState<EventRow | null>(null)
  const today = schoolToday()

  return (
    <>
      <PageHeader
        title={t.nav.events}
        action={<Button onClick={() => setForm({ title: '', description: '', date: today, subject: null, coins_pool: null })}><CalendarPlus /> {t.adminEvents.addEvent}</Button>}
      />
      {events.isPending ? <Skeleton className="h-80" /> : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {(events.data ?? []).map((e) => (
            <li key={e.id} className={cn('flex flex-wrap items-center gap-3 px-4 py-3', e.date.slice(0, 10) < today && 'bg-muted/40')}>
              <span className={cn('grid size-11 shrink-0 place-items-center rounded-lg text-sm font-bold tabular', e.date.slice(0, 10) >= today ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground')}>
                {formatDate(e.date).slice(0, 5)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{e.title}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {e.subject ? t.subjects[e.subject] : t.adminEvents.noSubject}{e.coins_pool != null ? ` · ${fmt(t.eventsPage.pool, { n: formatCoins(e.coins_pool) })}` : ''}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setResultsFor(e)}><ListOrdered /> {t.adminEvents.results}</Button>
              <Button variant="ghost" size="icon" aria-label={`${t.common.edit}: ${e.title}`} onClick={() => setForm({ ...e, date: e.date.slice(0, 10) })}><Pencil /></Button>
            </li>
          ))}
        </ul>
      )}

      {form && (
        <FormDialog
          open onOpenChange={(o) => !o && setForm(null)} title={form.id ? t.common.edit : t.adminEvents.addEvent}
          submitLabel={t.common.save} canSubmit={!!form.title.trim() && !!form.date}
          onSubmit={() => save.mutateAsync({ ...form, title: form.title.trim(), description: form.description.trim() })}
        >
          <div className="space-y-2">
            <Label htmlFor="e-title">{t.adminEvents.title}</Label>
            <Input id="e-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="e-desc">{t.adminEvents.description}</Label>
            <Textarea id="e-desc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="e-date">{t.adminEvents.date}</Label>
              <Input id="e-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t.adminEvents.subject}</Label>
              <Select value={form.subject ?? 'none'} onValueChange={(v) => setForm({ ...form, subject: v === 'none' ? null : (v as Subject) })}>
                <SelectTrigger className="w-full" aria-label={t.adminEvents.subject}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t.adminEvents.noSubject}</SelectItem>
                  {(['english', 'math', 'it'] as const).map((s) => <SelectItem key={s} value={s}>{t.subjects[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="e-pool">{t.adminEvents.pool}</Label>
            <Input id="e-pool" inputMode="numeric" value={form.coins_pool ?? ''} onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setForm({ ...form, coins_pool: v ? Number(v) : null }) }} />
          </div>
        </FormDialog>
      )}
      {resultsFor && <ResultsDialog ev={resultsFor} onClose={() => setResultsFor(null)} />}
    </>
  )
}
