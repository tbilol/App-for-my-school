import { useState } from 'react'
import { EyeOff, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CoinAmount } from '@/components/CoinAmount'
import { PageHeader } from '@/components/PageHeader'
import { useAllShopItems, useSaveShopItem, type ShopItemInput } from '@/features/admin/api'
import { FormDialog } from '@/features/manage/dialogs'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'
import type { ShopItem } from '@/types/models'

const blank: ShopItemInput = { name: '', description: '', emoji: '🎁', coin_price: 100, stock: 10, tier: 'small', active: true, sort_order: 0 }
const num = (v: string) => Math.max(0, Number(v.replace(/\D/g, '')) || 0)

export default function AdminShopPage() {
  const t = useT()
  const items = useAllShopItems()
  const save = useSaveShopItem()
  const [form, setForm] = useState<ShopItemInput | null>(null)
  const edit = (i: ShopItem) => setForm({ id: i.id, name: i.name, description: i.description, emoji: i.emoji, coin_price: i.coin_price, stock: i.stock, tier: i.tier, active: i.active, sort_order: i.sort_order })

  return (
    <>
      <PageHeader title={t.nav.shop} action={<Button onClick={() => setForm({ ...blank, sort_order: (items.data?.length ?? 0) + 1 })}><Plus /> {t.adminShop.addItem}</Button>} />
      {items.isPending ? <Skeleton className="h-96" /> : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {(items.data ?? []).map((i) => (
            <li key={i.id} className={cn('flex items-center gap-3 px-4 py-3', !i.active && 'opacity-60')}>
              <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-muted text-2xl">{i.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate font-medium">
                  {i.name}
                  {i.tier === 'big' && <span className="rounded bg-amber-100 px-1.5 text-[10px] font-bold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">TOP</span>}
                  {!i.active && <EyeOff className="size-3.5 text-muted-foreground" aria-label={t.adminShop.hidden} />}
                </div>
                <div className={cn('text-xs', i.stock < 1 ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                  {i.stock < 1 ? t.shop.outOfStock : `${t.adminShop.stock}: ${i.stock}`}
                </div>
              </div>
              <CoinAmount value={i.coin_price} className="text-sm" />
              <Button variant="ghost" size="icon" onClick={() => edit(i)} aria-label={`${t.common.edit}: ${i.name}`}><Pencil /></Button>
            </li>
          ))}
        </ul>
      )}

      {form && (
        <FormDialog
          open onOpenChange={(o) => !o && setForm(null)} title={form.id ? t.adminShop.editItem : t.adminShop.addItem}
          submitLabel={t.common.save} canSubmit={!!form.name.trim() && form.coin_price > 0}
          onSubmit={() => save.mutateAsync({ ...form, name: form.name.trim(), description: form.description.trim(), emoji: form.emoji.trim() || '🎁' })}
        >
          <div className="grid grid-cols-[4.5rem_1fr] gap-3">
            <div className="space-y-2">
              <Label htmlFor="s-emoji">{t.adminShop.emoji}</Label>
              <Input id="s-emoji" value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value.slice(0, 4) })} className="text-center text-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-name">{t.adminShop.name}</Label>
              <Input id="s-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-desc">{t.adminShop.description}</Label>
            <Textarea id="s-desc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="s-price">{t.adminShop.price}</Label>
              <Input id="s-price" inputMode="numeric" value={form.coin_price} onChange={(e) => setForm({ ...form, coin_price: num(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-stock">{t.adminShop.stock}</Label>
              <Input id="s-stock" inputMode="numeric" value={form.stock} onChange={(e) => setForm({ ...form, stock: num(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>{t.adminShop.tier}</Label>
              <Select value={form.tier} onValueChange={(v) => setForm({ ...form, tier: v as ShopItem['tier'] })}>
                <SelectTrigger className="w-full" aria-label={t.adminShop.tier}><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="small">{t.shop.small}</SelectItem><SelectItem value="big">{t.shop.big}</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            {t.adminShop.active}
            <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
          </label>
        </FormDialog>
      )}
    </>
  )
}
