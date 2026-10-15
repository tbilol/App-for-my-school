// Hand-written row types mirroring supabase/migrations. Replace with the
// generated `Database` types (npm run db:types) once a project is linked.

export type UserRole = 'student' | 'teacher' | 'admin'
export type Subject = 'english' | 'math' | 'it'
export type CoinDirection = 'earn' | 'spend'
export type CoinCategory = 'class_activity' | 'achievement' | 'event' | 'challenge' | 'purchase' | 'adjustment'

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  class_id: string | null
  avatar_url: string | null
  coin_balance: number
  created_at: string
  updated_at: string
}

export interface ClassRow {
  id: string
  name: string
  grade: number
}
