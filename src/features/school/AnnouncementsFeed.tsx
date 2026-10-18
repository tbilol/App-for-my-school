import { useState } from 'react'
import { Megaphone, Pin, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { UserAvatar } from '@/components/UserAvatar'
import { useAuth } from '@/features/auth/AuthProvider'
import { ConfirmDialog, FormDialog } from '@/features/manage/dialogs'
import { cn, formatDate } from '@/lib/utils'
import { useT } from '@/i18n'
import { useAnnouncementMutations, useAnnouncements } from './api'
import { EmptyState } from './components'

/** Feed for everyone; staff get a "new post" button and can delete their own posts (admin: any). */
export function AnnouncementsFeed() {
  const t = useT()
  const { profile, hasRole } = useAuth()
  const isStaff = hasRole('teacher', 'admin', 'super_admin')
  const isAdmin = hasRole('admin', 'super_admin')
  const feed = useAnnouncements()
  const { create, remove } = useAnnouncementMutations()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', pinned: false })
  const [deleting, setDeleting] = useState<string | null>(null)

  return (
    <div>
      {isStaff && (
        <div className="mb-4 flex justify-end">
          <Button onClick={() => { setForm({ title: '', body: '', pinned: false }); setOpen(true) }}><Plus /> {t.announcementsPage.new}</Button>
        </div>
      )}

      {feed.isPending ? <Skeleton className="h-72 w-full" /> : !feed.data?.length ? (
        <EmptyState icon={Megaphone} text={t.announcementsPage.empty} className="rounded-xl border bg-card" />
      ) : (
        <ul className="space-y-3" data-testid="announcements">
          {feed.data.map((a) => (
            <li key={a.id} className={cn('rounded-xl border bg-card p-4', a.pinned && 'border-primary/40 bg-primary-soft/50')}>
              <div className="flex items-start gap-3">
                <UserAvatar name={a.author_name} className="size-9" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{a.author_name}</span>
                    <span>{formatDate(a.created_at)}</span>
                    {a.pinned && <span className="inline-flex items-center gap-0.5 font-medium text-primary"><Pin className="size-3" /> {t.announcementsPage.pinned}</span>}
                  </div>
                  <h3 className="mt-1 font-semibold">{a.title}</h3>
                  {a.body && <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{a.body}</p>}
                </div>
                {isStaff && (isAdmin || a.created_by === profile?.id) && (
                  <Button variant="ghost" size="icon" className="shrink-0" aria-label={`${t.common.delete}: ${a.title}`} onClick={() => setDeleting(a.id)}>
                    <Trash2 />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <FormDialog
        open={open} onOpenChange={setOpen} title={t.announcementsPage.new} submitLabel={t.announcementsPage.publish}
        canSubmit={!!form.title.trim()}
        onSubmit={async () => { await create.mutateAsync(form); toast.success(t.announcementsPage.published) }}
      >
        <div className="space-y-2">
          <Label htmlFor="a-title">{t.announcementsPage.postTitle}</Label>
          <Input id="a-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
        </div>
        <div className="space-y-2">
          <Label htmlFor="a-body">{t.announcementsPage.postBody}</Label>
          <Textarea id="a-body" rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={form.pinned} onCheckedChange={(v) => setForm({ ...form, pinned: !!v })} /> {t.announcementsPage.pin}
        </label>
      </FormDialog>

      <ConfirmDialog
        open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title={t.common.delete}
        description={t.announcementsPage.deleteConfirm} confirmLabel={t.common.delete}
        onConfirm={() => remove.mutateAsync(deleting!)}
      />
    </div>
  )
}
