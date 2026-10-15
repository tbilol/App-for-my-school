// Readable random passwords for staff to hand out: no look-alikes (0/O, 1/l/I),
// always mixes upper, lower and digits. Crypto-grade randomness.
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const LOWER = 'abcdefghijkmnpqrstuvwxyz'
const DIGITS = '23456789'
const ALL = UPPER + LOWER + DIGITS

export function generatePassword(length = 10): string {
  for (;;) {
    const s = Array.from(crypto.getRandomValues(new Uint32Array(length)), (n) => ALL[n % ALL.length]).join('')
    // retry until every class is present (a handful of tries at most)
    if (/[A-Z]/.test(s) && /[a-z]/.test(s) && /[2-9]/.test(s)) return s
  }
}
