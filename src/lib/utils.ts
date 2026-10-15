import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 12500 → "12 500". Done by hand: Intl's uz-UZ data is missing on some WebViews and falls back to "12,500". */
export function formatCoins(n: number) {
  const sign = n < 0 ? '-' : ''
  return sign + Math.abs(Math.trunc(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')
}

/** 2026-10-15T… → "15.10.2026". Fixed format for the same WebView reason as formatCoins. */
export function formatDate(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}
