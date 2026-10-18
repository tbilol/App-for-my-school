import type { CoinTransaction } from '@/types/models'

// Coin history display: a subject's daily-task coins for one day show as ONE
// line. Purely presentational — the ledger keeps every row, and a group's
// amount is the exact sum of the rows it stands for.

export type TxLike = Pick<CoinTransaction, 'id' | 'amount' | 'direction' | 'category' | 'subject' | 'reason' | 'created_at'>

type DailyGroup = NonNullable<HistoryRow['daily']>

/** A ledger row, or a day+subject group of daily-task rows (`daily` set; id is then a string key). */
export type HistoryRow = Omit<TxLike, 'id'> & {
  id: TxLike['id'] | string
  daily?: {
    /** Ledger rows collapsed into this line. */
    rows: number
    /** "x/y" from a consolidated set row, when one is present. */
    score: string | null
    /** Per-answer rows ("to'g'ri javob") — the correct count for older sets. */
    correct: number
  }
}

// Old rule: "Kunlik vazifa: to'g'ri javob" (+2 each) and "Kunlik vazifa: to'plam bajarildi" (bonus).
// New rule: "<Fan> — kunlik vazifa (x/y)". Writing review ("… yozma ish tasdiqlandi") stays separate.
const PER_ANSWER = /^kunlik vazifa: to.?g.?ri javob/i
const SET_DONE = /^kunlik vazifa: to.?plam bajarildi/i
const CONSOLIDATED = /— kunlik vazifa \((\d+\/\d+)\)$/i

export function isDailyTaskTx(tx: TxLike) {
  if (tx.direction !== 'earn' || tx.category !== 'challenge' || !tx.subject) return false
  return PER_ANSWER.test(tx.reason) || SET_DONE.test(tx.reason) || CONSOLIDATED.test(tx.reason)
}

/** School-local calendar day of a timestamp (the app's day boundary). */
function dayOf(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' })
}

/**
 * Collapse daily-task rows by (day, subject), keeping list order: each group
 * sits where its newest row was (input is newest first). Other rows pass
 * through untouched.
 */
export function groupDailyTx<T extends TxLike>(list: T[]): (T | HistoryRow)[] {
  const out: (T | HistoryRow)[] = []
  const groups = new Map<string, HistoryRow & { daily: DailyGroup }>()
  for (const tx of list) {
    if (!isDailyTaskTx(tx)) { out.push(tx); continue }
    const key = `${dayOf(tx.created_at)}|${tx.subject}`
    let g = groups.get(key)
    if (g === undefined) {
      g = {
        id: `daily:${key}`, amount: 0, direction: 'earn', category: 'challenge', subject: tx.subject,
        reason: '', created_at: tx.created_at, daily: { rows: 0, score: null, correct: 0 },
      }
      groups.set(key, g)
      out.push(g)
    }
    g.amount += tx.amount
    g.daily.rows += 1
    if (PER_ANSWER.test(tx.reason)) g.daily.correct += 1
    g.daily.score ??= tx.reason.match(CONSOLIDATED)?.[1] ?? null
  }
  return out
}
