import { useEffect, useMemo, useState } from 'react'
import { Check, Inbox, Pencil, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CoinAmount } from '@/components/CoinAmount'
import { PageHeader } from '@/components/PageHeader'
import {
  useAllAchievements, useAllCatalog, useReviewAchievement, useSaveCatalogItem, useSuggestedCoins, type CatalogInput,
} from '@/features/admin/api'
import { useStudents } from '@/features/manage/api'
import { ConfirmDialog, FormDialog } from '@/features/manage/dialogs'
import { EmptyState } from '@/features/school/components'
import { cn, formatDate } from '@/lib/utils'
import { fmt, useT } from '@/i18n'
import type { Achievement, AchievementType, CatalogItem } from '@/types/models'

const TYPES: AchievementType[] = ['ielts', 'sat', 'national_cert', 'olympiad', 'other']
const num = (v: string) => Math.max(0, Number(v.replace(/\D/g, '')) || 0)

function ApproveDialog({ a, catalog, onClose }: { a: Achievement; catalog?: CatalogItem; onClose: () => void }) {
  const t = useT()
  const suggested = useSuggestedCoins(a)
  const review = useReviewAchievement()
  const [coins, setCoins] = useState<number | null>(null)
  // default: catalog value, else what app_config suggests
  useEffect(() => { if (coins === null && (catalog || suggested.data != null)) setCoins(catalog?.coins ?? suggested.data ?? 0) }, [catalog, suggested.data, coins])
  return (
    <FormDialog
      open onOpenChange={(o) => !o && onClose()} title={t.adminAchievements.approveWith} description={a.title}
      submitLabel={t.adminAchievements.approveWith} canSubmit={coins !== null}
      onSubmit={async () => { await review.mutateAsync({ id: a.id, approve: true, coins: coins ?? 0 }); toast.success(`+${coins} coin`) }}
    >
      <div className="space-y-2">
        <Label htmlFor="ach-coins">{t.adminAchievements.coins}</Label>
        <Input id="ach-coins" inputMode="numeric" value={coins ?? ''} onChange={(e) => setCoins(num(e.target.value))} />
        {suggested.data != null && <p className="text-xs text-muted-foreground">{fmt(t.adminAchievements.suggested, { n: suggested.data })}</p>}
      </div>
    </FormDialog>
  )
}

export default function AdminAchievementsPage() {
  const t = useT()
  const all = useAllAchievements()
  const catalog = useAllCatalog()
  const students = useStudents()
  const review = useReviewAchievement()
  const saveCatalog = useSaveCatalogItem()
  const [approving, setApproving] = useState<Achievement | null>(null)
  const [rejecting, setRejecting] = useState<Achievement | null>(null)
  const [editing, setEditing] = useState<CatalogInput | null>(null)

  const studentBy = useMemo(() => new Map((students.data ?? []).map((s) => [s.id, s.full_name])), [students.data])
  const catalogBy = useMemo(() => new Map((catalog.data ?? []).map((c) => [c.id, c])), [catalog.data])
  const queue = (all.data ?? []).filter((a) => a.status === 'pending')
  const history = (all.data ?? []).filter((a) => a.status !== 'pending')

  const row = (a: Achievement, actions?: React.ReactNode) => (
    <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
      <span className="text-2xl" aria-hidden>{(a.catalog_id && catalogBy.get(a.catalog_id)?.emoji) || '🏅'}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{a.title}</div>
        <div className="truncate text-xs text-muted-foreground">
          {studentBy.get(a.user_id) ?? '—'} · {t.adminAchievements.types[a.type]}{a.score != null ? ` · ${t.adminAchievements.score}: ${a.score}` : ''} · {formatDate(a.created_at)}
        </div>
      </div>
      {actions ?? (a.status === 'verified'
        ? <CoinAmount value={a.coins_awarded} className="text-sm" />
        : <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">{t.common.reject}</span>)}
    </li>
  )

  return (
    <>
      <PageHeader title={t.nav.achievements} />
      <Tabs defaultValue="queue">
        <TabsList className="mb-4">
          <TabsTrigger value="queue">{t.adminAchievements.queue} {queue.length > 0 && <span className="ml-1 rounded-full bg-warning px-1.5 text-xs text-amber-950">{queue.length}</span>}</TabsTrigger>
          <TabsTrigger value="history">{t.adminAchievements.history}</TabsTrigger>
          <TabsTrigger value="catalog">{t.adminAchievements.catalog}</TabsTrigger>
        </TabsList>

        <TabsContent value="queue">
          {all.isPending ? <Skeleton className="h-40" /> : queue.length === 0 ? <EmptyState icon={Inbox} text={t.adminAchievements.emptyQueue} className="rounded-xl border bg-card" /> : (
            <ul className="divide-y overflow-hidden rounded-xl border bg-card" data-testid="achievement-queue">
              {queue.map((a) => row(a, (
                <div className="flex gap-1.5">
                  <Button size="sm" onClick={() => setApproving(a)}><Check /> {t.common.approve}</Button>
                  <Button size="sm" variant="outline" onClick={() => setRejecting(a)}><X /> {t.common.reject}</Button>
                </div>
              )))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="history">
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">{history.map((a) => row(a))}</ul>
        </TabsContent>

        <TabsContent value="catalog">
          <div className="mb-3 flex justify-end">
            <Button onClick={() => setEditing({ type: 'other', title: '', description: '', emoji: '🏅', coins: 100, subject: null, sort_order: (catalog.data?.length ?? 0) + 1, active: true })}>
              <Plus /> {t.adminAchievements.addCatalog}
            </Button>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {(catalog.data ?? []).map((c) => (
              <li key={c.id} className={cn('flex items-start gap-3 rounded-xl border bg-card p-3', !c.active && 'opacity-55')}>
                <span className="text-3xl">{c.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{c.title}</div>
                  <div className="text-xs text-muted-foreground">{t.adminAchievements.types[c.type]}</div>
                  <CoinAmount value={c.coins} className="mt-1 text-sm" />
                </div>
                <Button variant="ghost" size="icon" aria-label={`${t.common.edit}: ${c.title}`} onClick={() => setEditing({ ...c })}><Pencil /></Button>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>

      {approving && <ApproveDialog a={approving} catalog={approving.catalog_id ? catalogBy.get(approving.catalog_id) : undefined} onClose={() => setApproving(null)} />}
      <ConfirmDialog
        open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)} title={t.common.reject}
        description={t.adminAchievements.rejectConfirm} confirmLabel={t.common.reject}
        onConfirm={() => review.mutateAsync({ id: rejecting!.id, approve: false })}
      />
      {editing && (
        <FormDialog
          open onOpenChange={(o) => !o && setEditing(null)} title={editing.id ? t.adminAchievements.editCatalog : t.adminAchievements.addCatalog}
          submitLabel={t.common.save} canSubmit={!!editing.title.trim()}
          onSubmit={() => saveCatalog.mutateAsync({ ...editing, title: editing.title.trim() })}
        >
          <div className="grid grid-cols-[4.5rem_1fr] gap-3">
            <div className="space-y-2">
              <Label htmlFor="c-emoji">{t.adminShop.emoji}</Label>
              <Input id="c-emoji" value={editing.emoji} onChange={(e) => setEditing({ ...editing, emoji: e.target.value.slice(0, 4) })} className="text-center text-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-title">{t.adminShop.name}</Label>
              <Input id="c-title" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-desc">{t.adminShop.description}</Label>
            <Textarea id="c-desc" rows={2} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t.adminAchievements.type}</Label>
              <Select value={editing.type} onValueChange={(v) => setEditing({ ...editing, type: v as AchievementType })}>
                <SelectTrigger className="w-full" aria-label={t.adminAchievements.type}><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((ty) => <SelectItem key={ty} value={ty}>{t.adminAchievements.types[ty]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-coins">{t.adminShop.price}</Label>
              <Input id="c-coins" inputMode="numeric" value={editing.coins} onChange={(e) => setEditing({ ...editing, coins: num(e.target.value) })} />
            </div>
          </div>
          <label className="flex items-center justify-between text-sm">{t.adminShop.active}<Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} /></label>
        </FormDialog>
      )}
    </>
  )
}
