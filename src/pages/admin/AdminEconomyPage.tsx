import { useEffect, useState, type ReactNode } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { PageHeader } from '@/components/PageHeader'
import { useAllConfig, useSaveConfig } from '@/features/admin/api'
import { errorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { fmt, useT } from '@/i18n'

// Shapes of the app_config rows this page edits (see the init migration).
type Tier = { min: number; coins: number }
type OlympiadLevel = 'school' | 'district' | 'region' | 'national' | 'international'
interface Economy {
  class_activity: { default: number; max_per_award: number; daily_cap_per_student: number }
  penalty: { max_per_action: number }
  event_place_coins: Record<'1' | '2' | '3' | 'participation', number>
  achievement_coins: {
    ielts: Tier[]; sat: Tier[]; national_cert: Tier[]
    olympiad: Record<OlympiadLevel, Record<'1' | '2' | '3' | 'participant', number>>
  }
  big_goal: { title: string; coins: number; item_id: string | null }
  shop: { auto_approve_small: boolean; max_pending_orders: number }
  challenge_defaults: { daily_task: number; quiz: number; weekly_task: number; streak_7: number }
}
const KEYS: (keyof Economy)[] = ['class_activity', 'penalty', 'event_place_coins', 'achievement_coins', 'big_goal', 'shop', 'challenge_defaults']
const LEVELS: OlympiadLevel[] = ['school', 'district', 'region', 'national', 'international']
const toNum = (v: string) => Math.max(0, Number(v.replace(/[^\d.]/g, '')) || 0)

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function NumField({ id, label, value, onChange, hideLabel = false }: { id: string; label: string; value: number; onChange: (n: number) => void; hideLabel?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className={cn('text-xs text-muted-foreground', hideLabel && 'sr-only')}>{label}</Label>
      <Input id={id} inputMode="decimal" value={value} onChange={(e) => onChange(toNum(e.target.value))} className="tabular" />
    </div>
  )
}

function TierEditor({ name, tiers, onChange }: { name: string; tiers: Tier[]; onChange: (t: Tier[]) => void }) {
  const t = useT()
  return (
    <div>
      <div className="mb-1.5 text-sm font-medium">{name}</div>
      <ul className="space-y-1.5">
        {tiers.map((tier, i) => (
          <li key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <NumField id={`${name}-min-${i}`} label={t.economy.minScore} hideLabel={i > 0} value={tier.min} onChange={(n) => onChange(tiers.map((x, j) => j === i ? { ...x, min: n } : x))} />
            <NumField id={`${name}-coins-${i}`} label="Coin" hideLabel={i > 0} value={tier.coins} onChange={(n) => onChange(tiers.map((x, j) => j === i ? { ...x, coins: n } : x))} />
            <Button variant="ghost" size="icon" aria-label={t.common.delete} onClick={() => onChange(tiers.filter((_, j) => j !== i))}><Trash2 /></Button>
          </li>
        ))}
      </ul>
      <Button variant="outline" size="sm" className="mt-2" onClick={() => onChange([...tiers, { min: 0, coins: 0 }])}><Plus /> {t.economy.addTier}</Button>
    </div>
  )
}

export default function AdminEconomyPage() {
  const t = useT()
  const config = useAllConfig()
  const save = useSaveConfig()
  const [form, setForm] = useState<Economy | null>(null)
  useEffect(() => { if (config.data && !form) setForm(structuredClone(config.data) as unknown as Economy) }, [config.data, form])

  if (config.isPending || !form) return (<><PageHeader title={t.economy.title} /><Skeleton className="h-96" /></>)
  const set = <K extends keyof Economy>(k: K, v: Economy[K]) => setForm({ ...form, [k]: v })
  const ac = form.achievement_coins

  async function saveAll() {
    try {
      // tiers are matched highest-min-first on the server; keep them sorted for readability
      const sorted = { ...ac, ielts: [...ac.ielts].sort((a, b) => a.min - b.min), sat: [...ac.sat].sort((a, b) => a.min - b.min), national_cert: [...ac.national_cert].sort((a, b) => a.min - b.min) }
      await save.mutateAsync(Object.fromEntries(KEYS.map((k) => [k, k === 'achievement_coins' ? sorted : form![k]])))
      toast.success(t.common.saved)
    } catch (err) { toast.error(errorMessage(err)) }
  }

  return (
    <>
      <PageHeader title={t.economy.title} description={t.economy.subtitle} />
      <div className="space-y-4 pb-20">
        <Section title={t.economy.classActivity}>
          <div className="grid gap-3 sm:grid-cols-3">
            <NumField id="ca-default" label={t.economy.perAward} value={form.class_activity.default} onChange={(n) => set('class_activity', { ...form.class_activity, default: n })} />
            <NumField id="ca-max" label={t.economy.maxPerAward} value={form.class_activity.max_per_award} onChange={(n) => set('class_activity', { ...form.class_activity, max_per_award: n })} />
            <NumField id="ca-cap" label={t.economy.dailyCap} value={form.class_activity.daily_cap_per_student} onChange={(n) => set('class_activity', { ...form.class_activity, daily_cap_per_student: n })} />
          </div>
          <div className="mt-3 max-w-xs">
            <NumField id="penalty" label={t.economy.penalty} value={form.penalty.max_per_action} onChange={(n) => set('penalty', { max_per_action: n })} />
          </div>
        </Section>

        <Section title={t.economy.events}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(['1', '2', '3'] as const).map((p) => (
              <NumField key={p} id={`ev-${p}`} label={fmt(t.economy.place, { n: p })} value={form.event_place_coins[p]} onChange={(n) => set('event_place_coins', { ...form.event_place_coins, [p]: n })} />
            ))}
            <NumField id="ev-part" label={t.economy.participation} value={form.event_place_coins.participation} onChange={(n) => set('event_place_coins', { ...form.event_place_coins, participation: n })} />
          </div>
        </Section>

        <Section title={t.economy.achievements}>
          <div className="grid gap-5 md:grid-cols-3">
            <TierEditor name="IELTS" tiers={ac.ielts} onChange={(v) => set('achievement_coins', { ...ac, ielts: v })} />
            <TierEditor name="SAT" tiers={ac.sat} onChange={(v) => set('achievement_coins', { ...ac, sat: v })} />
            <TierEditor name={t.adminAchievements.types.national_cert} tiers={ac.national_cert} onChange={(v) => set('achievement_coins', { ...ac, national_cert: v })} />
          </div>
          <div className="mt-5">
            <div className="mb-1.5 text-sm font-medium">{t.economy.olympiad}</div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[30rem] text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className="py-1 text-left font-medium" />
                    {(['1', '2', '3'] as const).map((p) => <th key={p} className="px-1 py-1 font-medium">{fmt(t.economy.place, { n: p })}</th>)}
                    <th className="px-1 py-1 font-medium">{t.economy.participant}</th>
                  </tr>
                </thead>
                <tbody>
                  {LEVELS.map((lvl) => (
                    <tr key={lvl}>
                      <td className="py-1 pr-2 font-medium whitespace-nowrap">{t.economy.levels[lvl]}</td>
                      {(['1', '2', '3', 'participant'] as const).map((p) => (
                        <td key={p} className="px-1 py-1">
                          <Input
                            aria-label={`${t.economy.levels[lvl]} ${p}`} inputMode="numeric" className="h-8 tabular"
                            value={ac.olympiad[lvl][p]}
                            onChange={(e) => set('achievement_coins', { ...ac, olympiad: { ...ac.olympiad, [lvl]: { ...ac.olympiad[lvl], [p]: toNum(e.target.value) } } })}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>

        <div className="grid gap-4 md:grid-cols-2">
          <Section title={t.economy.bigGoal}>
            <div className="grid grid-cols-[1fr_8rem] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="goal-title" className="text-xs text-muted-foreground">{t.economy.goalTitle}</Label>
                <Input id="goal-title" value={form.big_goal.title} onChange={(e) => set('big_goal', { ...form.big_goal, title: e.target.value })} />
              </div>
              <NumField id="goal-coins" label={t.economy.goalCoins} value={form.big_goal.coins} onChange={(n) => set('big_goal', { ...form.big_goal, coins: n })} />
            </div>
          </Section>
          <Section title={t.economy.shop}>
            <label className="mb-3 flex items-center justify-between gap-3 text-sm">
              {t.economy.autoApprove}
              <Switch checked={form.shop.auto_approve_small} onCheckedChange={(v) => set('shop', { ...form.shop, auto_approve_small: v })} />
            </label>
            <NumField id="shop-pending" label={t.economy.maxPending} value={form.shop.max_pending_orders} onChange={(n) => set('shop', { ...form.shop, max_pending_orders: n })} />
          </Section>
        </div>

        <Section title={t.economy.challenges}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <NumField id="ch-daily" label={t.economy.dailyTask} value={form.challenge_defaults.daily_task} onChange={(n) => set('challenge_defaults', { ...form.challenge_defaults, daily_task: n })} />
            <NumField id="ch-quiz" label={t.economy.quiz} value={form.challenge_defaults.quiz} onChange={(n) => set('challenge_defaults', { ...form.challenge_defaults, quiz: n })} />
            <NumField id="ch-weekly" label={t.economy.weeklyTask} value={form.challenge_defaults.weekly_task} onChange={(n) => set('challenge_defaults', { ...form.challenge_defaults, weekly_task: n })} />
            <NumField id="ch-streak" label={t.economy.streak7} value={form.challenge_defaults.streak_7} onChange={(n) => set('challenge_defaults', { ...form.challenge_defaults, streak_7: n })} />
          </div>
        </Section>
      </div>

      {/* sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:left-60">
        <div className="mx-auto flex max-w-5xl justify-end">
          <Button onClick={saveAll} disabled={save.isPending}>{save.isPending && <Loader2 className="animate-spin" />} {t.economy.saveAll}</Button>
        </div>
      </div>
    </>
  )
}
