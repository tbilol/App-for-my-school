// Hand-written row types mirroring supabase/migrations. Replace with the
// generated `Database` types (npm run db:types) once a project is linked.

export type UserRole = 'student' | 'teacher' | 'parent' | 'admin' | 'super_admin'
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
  /** Lowercase, unique; the user signs in with it. */
  login: string
  created_at: string
  updated_at: string
}

export interface ClassRow {
  id: string
  name: string
  grade: number
}

export interface CoinTransaction {
  id: number
  user_id: string
  amount: number
  direction: CoinDirection
  category: CoinCategory
  subject: Subject | null
  reason: string
  created_at: string
}

export interface LeaderboardRow {
  user_id: string
  full_name: string
  avatar_url: string | null
  class_id: string | null
  class_name: string | null
  points: number
  school_rank: number
  class_rank: number
}

export interface AuthSettings {
  min_password_length: number
}

export type ShopTier = 'small' | 'big'
export type OrderStatus = 'pending' | 'approved' | 'delivered' | 'rejected'
export type AchievementType = 'ielts' | 'sat' | 'national_cert' | 'olympiad' | 'other'
export type ReviewStatus = 'pending' | 'verified' | 'rejected'
export type ChallengeType = 'quiz' | 'task' | 'streak'
export type SubmissionStatus = 'submitted' | 'approved' | 'rejected'

export interface ShopItem {
  id: string
  name: string
  description: string
  emoji: string
  image_url: string | null
  coin_price: number
  stock: number
  tier: ShopTier
  active: boolean
  sort_order: number
}

export interface Order {
  id: string
  user_id: string
  item_id: string
  coin_cost: number
  status: OrderStatus
  note: string | null
  created_at: string
  reviewed_at: string | null
}

export interface CatalogItem {
  id: string
  type: AchievementType
  title: string
  description: string
  emoji: string
  coins: number
  subject: Subject | null
  sort_order: number
  active: boolean
}

export interface Achievement {
  id: string
  user_id: string
  catalog_id: string | null
  type: AchievementType
  title: string
  subject: Subject | null
  score: number | null
  coins_awarded: number
  status: ReviewStatus
  created_at: string
  verified_at: string | null
}

export interface EventRow {
  id: string
  title: string
  description: string
  date: string
  subject: Subject | null
  coins_pool: number | null
}

export interface EventResult {
  id: string
  event_id: string
  user_id: string
  place: number | null
  coins_awarded: number
}

export interface Announcement {
  id: string
  title: string
  body: string
  pinned: boolean
  created_by: string | null
  author_name: string
  created_at: string
}

export interface QuizQuestion { id: string; text: string; options: string[] }

export interface Challenge {
  id: string
  subject: Subject
  title: string
  description: string
  type: ChallengeType
  recurrence: 'once' | 'daily'
  coins_reward: number
  content: { questions?: QuizQuestion[] }
  pass_score: number
  streak_days: number | null
}

export interface Submission {
  id: string
  challenge_id: string
  status: SubmissionStatus
  score: number | null
  coins_awarded: number
  submitted_on: string
  created_at: string
}

// ───────── Daily tasks (20261020000000_daily_tasks.sql) ─────────

export type TaskSkill = 'grammar' | 'reading' | 'writing' | 'math' | 'it'
/** choice / exact are auto-graded; text is reviewed by a teacher. */
export type AnswerMode = 'choice' | 'exact' | 'text'
export type DailySetStatus = 'pending' | 'completed'
export type DailyItemStatus = 'pending' | 'answered' | 'approved' | 'rejected'

export interface Level {
  id: string
  subject: Subject
  ord: number
  name: string
  active: boolean
  created_at: string
}

export interface StudentLevel {
  user_id: string
  subject: Subject
  level_id: string
  set_by: string | null
  updated_at: string
}

/** Item body: `options` for choice items; reading items may carry a `passage`. */
export interface TaskBody { options?: string[]; passage?: string; [key: string]: unknown }

/** Staff only (RLS). Answer keys live in task_bank_keys, never here. */
export interface TaskBankItem {
  id: string
  subject: Subject
  level_id: string
  skill: TaskSkill
  answer_mode: AnswerMode
  prompt: string
  body: TaskBody
  difficulty: number
  active: boolean
  created_by: string | null
  created_at: string
}

export interface DailySet {
  id: string
  user_id: string
  subject: Subject
  set_date: string
  status: DailySetStatus
  /** Set when completed: true only if finished on set_date itself. */
  on_time: boolean | null
  completed_at: string | null
  created_at: string
}

/** What submit_daily_item takes, per answer mode. */
export type DailyAnswer = { choice: number } | { value: string } | { text: string }

/** Snapshot of a bank item inside a set. Never contains the correct answer. */
export interface DailyItem {
  id: string
  set_id: string
  task_id: string
  ord: number
  skill: TaskSkill
  answer_mode: AnswerMode
  prompt: string
  body: TaskBody
  status: DailyItemStatus
  student_answer: DailyAnswer | null
  is_correct: boolean | null
  coins_awarded: number
  reviewed_by: string | null
  reviewed_at: string | null
  answered_at: string | null
}

/** submit_daily_item's result: the answered item plus what the UI needs next. */
export interface DailySubmitResult extends DailyItem {
  /** Revealed only after answering; null for text items. Choice indices are 0-based. */
  correct_answer: { correct?: number | number[]; value?: string; values?: string[] } | null
  set_status: DailySetStatus
  /** Set once completed: true = on its own day (bonus + streak). */
  set_on_time: boolean | null
  /** Coins this set has paid so far (items + completion bonus). */
  set_coins: number
}

/** subject null = the overall streak (every subject on time that day). */
export interface StudentStreak {
  id: string
  user_id: string
  subject: Subject | null
  current_streak: number
  longest_streak: number
  last_completed_on: string | null
  updated_at: string
}
