import { cn, formatCoins } from '@/lib/utils'

/** Coin glyph + formatted amount. The amber glyph is the only non-blue accent for coins. */
export function CoinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn('size-4 shrink-0', className)}>
      <circle cx="12" cy="12" r="10" fill="var(--coin)" />
      <circle cx="12" cy="12" r="7" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="1.5" />
      <path d="M9.5 8.5h5v1.3l-3.4 4.4h3.4v1.3h-5v-1.3l3.4-4.4H9.5z" fill="#fff" />
    </svg>
  )
}

export function CoinAmount({ value, className, iconClassName }: { value: number; className?: string; iconClassName?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 font-semibold tabular', className)}>
      <CoinIcon className={iconClassName} />
      {formatCoins(value)}
    </span>
  )
}
