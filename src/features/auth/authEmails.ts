// Mirrors private.login_email in the database. Users only ever type their
// login; this address exists so Supabase Auth can look the account up.
// The password check happens in Supabase.

export const LOGIN_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/

/** Logins are case-insensitive: stored and compared lowercase. */
export function normalizeLogin(login: string) {
  return login.trim().toLowerCase()
}

/** null when the login can't exist (wrong format) — callers show the generic error. */
export function loginEmail(login: string) {
  const v = normalizeLogin(login)
  return LOGIN_PATTERN.test(v) ? `${v}@zamin.local` : null
}
