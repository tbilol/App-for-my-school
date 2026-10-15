import { t } from '@/i18n'

type ErrorCode = keyof typeof t.errors

/** Maps a Supabase/PostgREST error (or any thrown value) to a translated message. */
export function errorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : typeof err === 'object' && err && 'message' in err ? String(err.message) : ''
  if (raw in t.errors) return t.errors[raw as ErrorCode]
  if (/Failed to fetch|NetworkError|network/i.test(raw)) return t.errors.network
  return t.errors.unknown
}
