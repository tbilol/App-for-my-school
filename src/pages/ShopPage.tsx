import { useMemo, useState } from 'react'
import { Loader2, PackageOpen, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { CoinAmount } from '@/components/CoinAmount'
import { PageHeader } from '@/components/PageHeader'
import { useAuth } from '@/features/auth/AuthProvider'
import { EmptyState, SectionCard } from '@/features/school/components'
import { useMyOrders, useRedeem, useShopItems } from '@/features/school/api'
import { errorMessage } from '@/lib/errors'
import { cn, formatCoins, formatDate } from '@/lib/utils'
import { fmt, useT } from '@/i18n'
import type { OrderStatus, ShopItem, ShopTier } from '@/types/models'

const statusStyle: Record<OrderStatus, string> = {
  pending: 'bg-warning/15 text-amber-700 dark:text-amber-300',
  approved: 'bg-primary-soft text-primary',
  delivered: 'bg-success/10 text-success',
  rejected: 'bg-destructive/10 text-destructive',
}

export function ItemArt({ item, className }: { item: Pick<ShopItem, 'emoji' | 'image_url' | 'name' | 'tier'>; className?: string }) {
  return (
    <div className={cn('grid aspect-square place-items-center overflow-hidden rounded-lg', item.tier === 'big' ? 'bg-gradient-to-br from-primary-soft to-amber-50 dark:to-amber-950/40' : 'bg-muted', className)}>
      {item.image_url
        ? <img src={item.image_url} alt={item.name} className="size-full object-cover" loading="lazy" />
        : <span className="text-5xl leading-none select-none" aria-hidden>{item.emoji}</span>}
    </div>
  )
}

export default function ShopPage() {
  const t = useT()
  const { profile } = useAuth()
  const isStudent = profile?.role === 'student'
  const balance = profile?.coin_balance ?? 0
  const items = useShopItems()
  const orders = useMyOrders()
  const redeem = useRedeem()
  const [tier, setTier] = useState<ShopTier | 'all'>('all')
  const [confirm, setConfirm] = useState<ShopItem | null>(null)

  const shown = useMemo(() => (items.data ?? []).filter((i) => tier === 'all' || i.tier === tier), [items.data, tier])
  const itemById = useMemo(() => new Map((items.data ?? []).map((i) => [i.id, i])), [items.data])

  async function buy(item: ShopItem) {
    try {
      await redeem.mutateAsync(item.id)
      toast.success(t.shop.success, { description: `${item.emoji} ${item.name} · −${formatCoins(item.coin_price)} coin` })
      setConfirm(null)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <>
      <PageHeader
        title={t.shop.title}
        description={t.shop.subtitle}
        action={isStudent && (
          <div className="shrink-0 rounded-full bg-primary-soft px-3 py-1.5 text-primary" data-testid="shop-balance">
            <CoinAmount value={balance} />
          </div>
        )}
      />

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0" role="tablist">
        {(['all', 'small', 'big'] as const).map((k) => (
          <button
            key={k} role="tab" aria-selected={tier === k} onClick={() => setTier(k)}
            className={cn('shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
              tier === k ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-secondary')}
          >
            {k === 'all' ? t.shop.all : t.shop[k]}
          </button>
        ))}
      </div>

      {!isStudent && <p className="mb-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{t.shop.staffNote}</p>}

      {items.isPending ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-64" />)}</div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((item) => {
            const out = item.stock < 1
            const short = Math.max(0, item.coin_price - balance)
            return (
              <li
                key={item.id}
                data-testid="shop-item"
                className={cn('flex flex-col rounded-xl border bg-card p-2.5', out && 'opacity-55 grayscale')}
              >
                <div className="relative">
                  <ItemArt item={item} />
                  {item.tier === 'big' && <span className="absolute top-1.5 left-1.5 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950">TOP</span>}
                </div>
                <div className="mt-2.5 flex flex-1 flex-col">
                  <h3 className="line-clamp-1 text-sm font-semibold">{item.name}</h3>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                  <div className="mt-auto pt-2">
                    <CoinAmount value={item.coin_price} className="text-base" />
                    <div className={cn('text-[11px]', out ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                      {out ? t.shop.outOfStock : fmt(t.shop.inStock, { n: item.stock })}
                    </div>
                    {isStudent && !out && short > 0 && (
                      <div className="mt-1.5">
                        <Progress value={Math.min(100, (balance / item.coin_price) * 100)} className="h-1.5" />
                        <div className="mt-1 text-[11px] text-muted-foreground">{fmt(t.shop.need, { n: formatCoins(short) })}</div>
                      </div>
                    )}
                    {isStudent && (
                      <Button
                        size="sm" className="mt-2 w-full"
                        disabled={out || short > 0}
                        onClick={() => setConfirm(item)}
                      >
                        {out ? t.shop.outOfStock : short > 0 ? t.shop.insufficient : t.shop.buy}
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {isStudent && (
        <SectionCard title={t.shop.myOrders} className="mt-6">
          {orders.isPending ? <Skeleton className="m-4 h-16" /> : !orders.data?.length ? (
            <EmptyState icon={PackageOpen} text={t.shop.noOrders} />
          ) : (
            <ul className="divide-y" data-testid="my-orders">
              {orders.data.map((o) => {
                const item = itemById.get(o.item_id)
                return (
                  <li key={o.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-2xl" aria-hidden>{item?.emoji ?? '🎁'}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{item?.name ?? '—'}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(o.created_at)} · {formatCoins(o.coin_cost)} coin</div>
                    </div>
                    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', statusStyle[o.status])}>{t.shop.status[o.status]}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </SectionCard>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          {confirm && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2"><span className="text-2xl">{confirm.emoji}</span> {confirm.name}</AlertDialogTitle>
                <AlertDialogDescription>{fmt(t.shop.confirmBody, { price: formatCoins(confirm.coin_price) })}</AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
                <span className="text-muted-foreground">{t.shop.afterBalance}</span>
                <CoinAmount value={balance - confirm.coin_price} />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={redeem.isPending}>{t.common.cancel}</AlertDialogCancel>
                <AlertDialogAction disabled={redeem.isPending} onClick={(e) => { e.preventDefault(); void buy(confirm) }}>
                  {redeem.isPending ? <Loader2 className="animate-spin" /> : <ShoppingBag />} {t.shop.buy}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
