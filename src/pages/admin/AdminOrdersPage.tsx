import { useMemo, useState } from 'react'
import { Check, PackageOpen, Truck, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/PageHeader'
import { useAllOrders, useAllShopItems, useReviewOrder } from '@/features/admin/api'
import { useManagedClasses, useStudents } from '@/features/manage/api'
import { ConfirmDialog } from '@/features/manage/dialogs'
import { EmptyState } from '@/features/school/components'
import { errorMessage } from '@/lib/errors'
import { cn, formatCoins, formatDate } from '@/lib/utils'
import { useT } from '@/i18n'
import type { Order, OrderStatus } from '@/types/models'

const TABS: OrderStatus[] = ['pending', 'approved', 'delivered', 'rejected']

export default function AdminOrdersPage() {
  const t = useT()
  const orders = useAllOrders()
  const items = useAllShopItems()
  const students = useStudents()
  const classes = useManagedClasses()
  const review = useReviewOrder()
  const [tab, setTab] = useState<OrderStatus>('pending')
  const [rejecting, setRejecting] = useState<Order | null>(null)

  const itemBy = useMemo(() => new Map((items.data ?? []).map((i) => [i.id, i])), [items.data])
  const studentBy = useMemo(() => new Map((students.data ?? []).map((s) => [s.id, s])), [students.data])
  const classBy = useMemo(() => new Map((classes.data ?? []).map((c) => [c.id, c.name])), [classes.data])
  const shown = (orders.data ?? []).filter((o) => o.status === tab)
  const count = (s: OrderStatus) => (orders.data ?? []).filter((o) => o.status === s).length

  async function move(o: Order, status: OrderStatus) {
    try { await review.mutateAsync({ id: o.id, status }); toast.success(t.shop.status[status]) } catch (err) { toast.error(errorMessage(err)) }
  }

  return (
    <>
      <PageHeader title={t.nav.orders} />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist">
        {TABS.map((s) => (
          <button key={s} role="tab" aria-selected={tab === s} onClick={() => setTab(s)}
            className={cn('flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium',
              tab === s ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-secondary')}>
            {t.shop.status[s]} <span className={cn('rounded-full px-1.5 text-xs', tab === s ? 'bg-white/20' : 'bg-muted')}>{count(s)}</span>
          </button>
        ))}
      </div>
      {orders.isPending ? <Skeleton className="h-64" /> : shown.length === 0 ? (
        <EmptyState icon={PackageOpen} text={t.adminOrders.empty} className="rounded-xl border bg-card" />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card" data-testid="admin-orders">
          {shown.map((o) => {
            const item = itemBy.get(o.item_id)
            const s = studentBy.get(o.user_id)
            return (
              <li key={o.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="text-2xl" aria-hidden>{item?.emoji ?? '🎁'}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{item?.name ?? '—'}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {s?.full_name ?? '—'}{s?.class_id ? ` · ${classBy.get(s.class_id) ?? ''}` : ''} · {formatDate(o.created_at)} · {formatCoins(o.coin_cost)} coin
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {o.status === 'pending' && <Button size="sm" onClick={() => move(o, 'approved')} disabled={review.isPending}><Check /> {t.adminOrders.approve}</Button>}
                  {o.status === 'approved' && <Button size="sm" onClick={() => move(o, 'delivered')} disabled={review.isPending}><Truck /> {t.adminOrders.deliver}</Button>}
                  {(o.status === 'pending' || o.status === 'approved') && (
                    <Button size="sm" variant="outline" onClick={() => setRejecting(o)}><X /> {t.adminOrders.reject}</Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <ConfirmDialog
        open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)} title={t.adminOrders.reject}
        description={t.adminOrders.rejectConfirm} confirmLabel={t.adminOrders.reject}
        onConfirm={() => review.mutateAsync({ id: rejecting!.id, status: 'rejected' })}
      />
    </>
  )
}
