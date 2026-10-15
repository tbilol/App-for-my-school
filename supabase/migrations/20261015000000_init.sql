-- ═══════════════════════════════════════════════════════════════════════════
--  Zamin Students — initial schema
--  Postgres / Supabase. Run with `supabase db push` or `supabase db reset`.
--
--  Core invariant:
--    profiles.coin_balance  ==  Σ(earn) − Σ(spend)  over coin_transactions
--  • coin_transactions is an append-only ledger (no UPDATE/DELETE).
--  • coin_balance is written ONLY by the ledger trigger; any other write raises.
--  • Clients never insert ledger rows; all coin movement goes through
--    SECURITY DEFINER RPCs that check role + read amounts from app_config.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- Internal helpers live in `private`, which PostgREST does not expose,
-- so they cannot be called as RPCs from the client.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;  -- needed so RLS policies can call helpers

-- ───────────────────────────── Enums ─────────────────────────────
create type public.user_role         as enum ('student', 'teacher', 'admin');
create type public.coin_direction    as enum ('earn', 'spend');
create type public.coin_category     as enum ('class_activity', 'achievement', 'event', 'challenge', 'purchase', 'adjustment');
create type public.subject           as enum ('english', 'math', 'it');
create type public.achievement_type  as enum ('ielts', 'sat', 'national_cert', 'olympiad', 'other');
create type public.olympiad_level    as enum ('school', 'district', 'region', 'national', 'international');
create type public.review_status     as enum ('pending', 'verified', 'rejected');
create type public.challenge_type    as enum ('quiz', 'task', 'streak');
create type public.challenge_recurrence as enum ('once', 'daily');
create type public.submission_status as enum ('submitted', 'approved', 'rejected');
create type public.shop_tier         as enum ('small', 'big');
create type public.order_status      as enum ('pending', 'approved', 'delivered', 'rejected');

-- ───────────────────────────── Tables ─────────────────────────────

create table public.classes (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,                 -- e.g. "9-A"
  grade      smallint not null check (grade between 1 and 11),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  full_name    text not null default '',
  role         public.user_role not null default 'student',
  class_id     uuid references public.classes (id) on delete set null,
  avatar_url   text,
  coin_balance integer not null default 0 check (coin_balance >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index profiles_class_idx on public.profiles (class_id);
create index profiles_role_idx  on public.profiles (role);

create table public.coin_transactions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  amount     integer not null check (amount > 0),
  direction  public.coin_direction not null,
  category   public.coin_category not null,
  subject    public.subject,
  reason     text not null default '',
  awarded_by uuid references public.profiles (id) on delete set null,
  ref_table  text,       -- e.g. 'orders', 'achievements' — links a row to its source
  ref_id     uuid,
  created_at timestamptz not null default now()
);
create index coin_tx_user_created_idx on public.coin_transactions (user_id, created_at desc);
create index coin_tx_rating_idx       on public.coin_transactions (user_id, subject) where direction = 'earn';
create index coin_tx_ref_idx          on public.coin_transactions (ref_table, ref_id);

create table public.achievements (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  type          public.achievement_type not null,
  title         text not null,
  subject       public.subject,                 -- coins are tagged with this subject
  level         public.olympiad_level,          -- olympiads only
  score         numeric(7, 2),                  -- IELTS 7.5, SAT 1450, national cert points, olympiad place…
  coins_awarded integer not null default 0 check (coins_awarded >= 0),
  proof_url     text,                           -- path in the private `proofs` bucket
  status        public.review_status not null default 'pending',
  verified_by   uuid references public.profiles (id) on delete set null,
  verified_at   timestamptz,
  review_note   text,
  created_at    timestamptz not null default now()
);
create index achievements_user_idx   on public.achievements (user_id);
create index achievements_status_idx on public.achievements (status) where status = 'pending';

create table public.events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text not null default '',
  date        date not null,
  subject     public.subject,
  coins_pool  integer check (coins_pool >= 0),  -- null = no cap
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index events_date_idx on public.events (date);

create table public.event_results (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  place         smallint check (place > 0),     -- null = participation
  coins_awarded integer not null default 0 check (coins_awarded >= 0),
  recorded_by   uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (event_id, user_id)
);

create table public.challenges (
  id           uuid primary key default gen_random_uuid(),
  subject      public.subject not null,
  title        text not null,
  description  text not null default '',
  type         public.challenge_type not null,
  recurrence   public.challenge_recurrence not null default 'once',
  coins_reward integer not null check (coins_reward >= 0),
  -- quiz: { "questions": [ { "id": "q1", "text": "...", "options": ["a","b","c"] } ] }
  -- (answer key is NOT here — see challenge_answer_keys)
  content      jsonb not null default '{}'::jsonb,
  pass_score   smallint not null default 60 check (pass_score between 0 and 100),
  streak_days  smallint check (streak_days > 1), -- streak challenges only
  starts_on    date,
  ends_on      date,
  created_by   uuid references public.profiles (id) on delete set null,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  check (type <> 'streak' or streak_days is not null)
);
create index challenges_active_subject_idx on public.challenges (subject) where active;

-- Staff-only answer key so students can read quizzes without seeing answers.
create table public.challenge_answer_keys (
  challenge_id uuid primary key references public.challenges (id) on delete cascade,
  answers      jsonb not null   -- { "q1": 2, "q2": 0 }  (index of correct option)
);

create table public.challenge_submissions (
  id            uuid primary key default gen_random_uuid(),
  challenge_id  uuid not null references public.challenges (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  status        public.submission_status not null default 'submitted',
  answer        text,
  quiz_answers  jsonb,
  proof_url     text,
  score         numeric(5, 2),
  coins_awarded integer not null default 0 check (coins_awarded >= 0),
  submitted_on  date not null,                  -- school-local date, for daily/streak logic
  reviewed_by   uuid references public.profiles (id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (challenge_id, user_id, submitted_on)
);
create index submissions_user_idx    on public.challenge_submissions (user_id, submitted_on desc);
create index submissions_pending_idx on public.challenge_submissions (status) where status = 'submitted';

create table public.shop_items (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text not null default '',
  image_url   text,
  coin_price  integer not null check (coin_price > 0),
  stock       integer not null default 0 check (stock >= 0),
  tier        public.shop_tier not null default 'small',
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table public.orders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  item_id     uuid not null references public.shop_items (id) on delete restrict,
  coin_cost   integer not null check (coin_cost > 0),
  status      public.order_status not null default 'pending',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  note        text,
  created_at  timestamptz not null default now()
);
create index orders_user_idx    on public.orders (user_id, created_at desc);
create index orders_pending_idx on public.orders (status) where status in ('pending', 'approved');

create table public.app_config (
  key         text primary key,
  value       jsonb not null,
  description text not null default '',
  updated_at  timestamptz not null default now()
);

create table public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null default '',
  pinned     boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Capacitor push tokens (FCM on Android, APNs on iOS). One row per device.
create table public.push_tokens (
  token      text primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  platform   text not null check (platform in ('android', 'ios', 'web')),
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

-- ─────────────────────────── Private helpers ───────────────────────────

create function private.my_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.my_role() = 'admin', false)
$$;

create function private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.my_role() in ('teacher', 'admin'), false)
$$;

create function private.require_staff() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
end $$;

create function private.require_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
end $$;

create function private.cfg(p_key text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select value from public.app_config where key = p_key
$$;

create function private.cfg_int(p_key text, p_path text[] default '{}') returns integer
language sql stable security definer set search_path = '' as $$
  select (private.cfg(p_key) #>> p_path)::integer
$$;

-- "Today" in the school's timezone (default Asia/Tashkent).
create function private.school_today() returns date
language sql stable security definer set search_path = '' as $$
  select (now() at time zone coalesce(private.cfg('timezone') #>> '{}', 'Asia/Tashkent'))::date
$$;

-- The ONLY way coins move. Inserts a ledger row; the trigger updates the balance.
create function private.grant_coins(
  p_user uuid, p_amount integer, p_direction public.coin_direction,
  p_category public.coin_category, p_subject public.subject, p_reason text,
  p_awarded_by uuid, p_ref_table text default null, p_ref_id uuid default null
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  insert into public.coin_transactions (user_id, amount, direction, category, subject, reason, awarded_by, ref_table, ref_id)
  values (p_user, p_amount, p_direction, p_category, p_subject, coalesce(p_reason, ''), p_awarded_by, p_ref_table, p_ref_id)
  returning id into v_id;
  return v_id;
end $$;

-- ─────────────────────── Ledger integrity triggers ───────────────────────

-- Apply each ledger row to the cached balance. The CHECK (coin_balance >= 0)
-- makes an overspend fail atomically.
create function private.apply_coin_transaction() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('zamin.ledger_write', 'on', true);
  update public.profiles
     set coin_balance = coin_balance + case when new.direction = 'earn' then new.amount else -new.amount end
   where id = new.user_id;
  perform set_config('zamin.ledger_write', 'off', true);
  return new;
exception when check_violation then
  raise exception 'insufficient_coins' using errcode = 'P0001';
end $$;

create trigger coin_transactions_apply
  after insert on public.coin_transactions
  for each row execute function private.apply_coin_transaction();

create function private.ledger_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'coin_transactions is append-only; post an adjustment instead' using errcode = '42501';
end $$;

create trigger coin_transactions_no_update
  before update or delete on public.coin_transactions
  for each row execute function private.ledger_immutable();

-- Guard profile updates:
--  • coin_balance may only change through the ledger trigger;
--  • role / class_id may only be changed by an admin (or server-side code with no JWT).
create function private.guard_profile_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.coin_balance is distinct from old.coin_balance
     and coalesce(current_setting('zamin.ledger_write', true), 'off') <> 'on' then
    raise exception 'coin_balance is managed by the ledger' using errcode = '42501';
  end if;

  if (new.role is distinct from old.role or new.class_id is distinct from old.class_id)
     and auth.uid() is not null and not private.is_admin() then
    raise exception 'only admins can change role or class' using errcode = '42501';
  end if;

  new.updated_at := now();
  return new;
end $$;

create trigger profiles_guard
  before update on public.profiles
  for each row execute function private.guard_profile_update();

-- New auth user → profile. Role is ALWAYS 'student' regardless of signup metadata.
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Admin tool: verify the invariant (should always return zero rows).
create view private.balance_drift as
  select p.id, p.coin_balance,
         coalesce(sum(case when t.direction = 'earn' then t.amount else -t.amount end), 0)::integer as ledger_sum
    from public.profiles p
    left join public.coin_transactions t on t.user_id = p.id
   group by p.id
  having p.coin_balance <> coalesce(sum(case when t.direction = 'earn' then t.amount else -t.amount end), 0);
revoke all on private.balance_drift from public, anon, authenticated;

-- ───────────────────────── Streak evaluation ─────────────────────────
-- A streak = consecutive school days (skipping weekdays in
-- app_config.streak_skip_weekdays, default Sunday) with ≥1 approved
-- submission in the subject. Reaching streak_days pays coins_reward once per cycle.
create function private.evaluate_streaks(p_user uuid, p_subject public.subject) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c        record;
  v_today  date := private.school_today();
  v_skip   int[] := coalesce(
             (select array_agg(x::int) from jsonb_array_elements_text(private.cfg('streak_skip_weekdays')) x),
             array[0]);
  v_day    date;
  v_count  int;
  v_last   date;
  v_sid    uuid;
begin
  for c in
    select * from public.challenges
     where type = 'streak' and active and subject = p_subject
       and (starts_on is null or starts_on <= v_today)
       and (ends_on   is null or ends_on   >= v_today)
  loop
    -- last time this streak paid out; a new cycle starts the day after
    select max(submitted_on) into v_last
      from public.challenge_submissions
     where challenge_id = c.id and user_id = p_user and status = 'approved';

    v_day := v_today; v_count := 0;
    while v_count < c.streak_days loop
      exit when v_last is not null and v_day <= v_last;
      if extract(dow from v_day)::int = any (v_skip) then
        v_day := v_day - 1; continue;
      end if;
      exit when not exists (
        select 1 from public.challenge_submissions s
          join public.challenges ch on ch.id = s.challenge_id
         where s.user_id = p_user and s.status = 'approved' and s.submitted_on = v_day
           and ch.subject = p_subject and ch.type <> 'streak');
      v_count := v_count + 1;
      v_day := v_day - 1;
    end loop;

    if v_count >= c.streak_days then
      v_sid := null;
      insert into public.challenge_submissions (challenge_id, user_id, status, score, coins_awarded, submitted_on, reviewed_at)
      values (c.id, p_user, 'approved', v_count, c.coins_reward, v_today, now())
      on conflict (challenge_id, user_id, submitted_on) do nothing
      returning id into v_sid;
      if v_sid is not null and c.coins_reward > 0 then
        perform private.grant_coins(p_user, c.coins_reward, 'earn', 'challenge', c.subject,
                                    c.title || ' (' || v_count || ' kunlik seriya)', null, 'challenge_submissions', v_sid);
      end if;
    end if;
  end loop;
end $$;

-- ───────────────────────────── Public RPCs ─────────────────────────────
-- Errors are raised as stable codes (e.g. 'insufficient_coins') that the
-- frontend maps to i18n strings.

-- Teacher: award class-activity coins to one or more students.
-- Students over today's cap are skipped. Returns how many were awarded.
create function public.award_class_activity(
  p_student_ids uuid[], p_subject public.subject, p_amount integer default null, p_reason text default null
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_amount int := coalesce(p_amount, private.cfg_int('class_activity', '{default}'));
  v_max    int := private.cfg_int('class_activity', '{max_per_award}');
  v_cap    int := private.cfg_int('class_activity', '{daily_cap_per_student}');
  v_today  date := private.school_today();
  v_tz     text := coalesce(private.cfg('timezone') #>> '{}', 'Asia/Tashkent');
  v_sid    uuid;
  v_used   int;
  v_n      int := 0;
begin
  perform private.require_staff();
  if v_amount is null or v_amount <= 0 or (v_max is not null and v_amount > v_max) then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  foreach v_sid in array p_student_ids loop
    continue when not exists (select 1 from public.profiles where id = v_sid and role = 'student');
    perform 1 from public.profiles where id = v_sid for update;   -- serialize cap checks per student
    select coalesce(sum(amount), 0) into v_used
      from public.coin_transactions
     where user_id = v_sid and category = 'class_activity' and direction = 'earn'
       and (created_at at time zone v_tz)::date = v_today;
    continue when v_cap is not null and v_used + v_amount > v_cap;
    perform private.grant_coins(v_sid, v_amount, 'earn', 'class_activity', p_subject,
                                coalesce(nullif(p_reason, ''), 'Darsdagi faollik'), auth.uid());
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- Teacher: deduct coins for discipline issues. Clamped to the student's balance.
create function public.penalize_student(p_student uuid, p_amount integer, p_reason text)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_max int := private.cfg_int('penalty', '{max_per_action}');
  v_bal int;
  v_amt int;
begin
  perform private.require_staff();
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required' using errcode = '22023'; end if;
  if p_amount is null or p_amount <= 0 or (v_max is not null and p_amount > v_max) then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  select coin_balance into v_bal from public.profiles where id = p_student and role = 'student' for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_amt := least(p_amount, v_bal);
  if v_amt > 0 then
    perform private.grant_coins(p_student, v_amt, 'spend', 'adjustment', null, p_reason, auth.uid());
  end if;
  return v_amt;
end $$;

-- Admin: arbitrary signed correction (positive = add, negative = remove).
create function public.admin_adjust_coins(p_user uuid, p_amount integer, p_reason text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required' using errcode = '22023'; end if;
  if p_amount = 0 or p_amount is null then raise exception 'invalid_amount' using errcode = '22023'; end if;
  perform private.grant_coins(p_user, abs(p_amount),
                              case when p_amount > 0 then 'earn' else 'spend' end::public.coin_direction,
                              'adjustment', null, p_reason, auth.uid());
end $$;

-- Suggested coins for an achievement, from app_config.achievement_coins.
-- ielts/sat/national_cert: tiers [{min, coins}] matched on score (highest min ≤ score).
-- olympiad: { level: { "1": coins, "2": …, "3": …, "participant": coins } } — score = place.
create function public.suggest_achievement_coins(
  p_type public.achievement_type, p_score numeric, p_level public.olympiad_level default null
) returns integer
language plpgsql stable security definer set search_path = '' as $$
declare
  v_cfg jsonb := private.cfg('achievement_coins') -> p_type::text;
  v_res int;
begin
  if v_cfg is null then return null; end if;
  if p_type = 'olympiad' then
    if p_level is null then return null; end if;
    return coalesce((v_cfg -> p_level::text ->> (p_score::int)::text)::int,
                    (v_cfg -> p_level::text ->> 'participant')::int);
  end if;
  if jsonb_typeof(v_cfg) = 'array' and p_score is not null then
    select (t ->> 'coins')::int into v_res
      from jsonb_array_elements(v_cfg) t
     where (t ->> 'min')::numeric <= p_score
     order by (t ->> 'min')::numeric desc
     limit 1;
    return coalesce(v_res, 0);
  end if;
  return null;
end $$;

-- Admin: verify or reject a student-submitted achievement.
create function public.review_achievement(
  p_achievement uuid, p_approve boolean, p_coins integer default null, p_note text default null
) returns public.achievements
language plpgsql security definer set search_path = '' as $$
declare
  a public.achievements;
  v_coins int;
begin
  perform private.require_admin();
  select * into a from public.achievements where id = p_achievement for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if a.status <> 'pending' then raise exception 'already_reviewed' using errcode = 'P0001'; end if;

  if p_approve then
    v_coins := coalesce(p_coins, public.suggest_achievement_coins(a.type, a.score, a.level));
    if v_coins is null or v_coins < 0 then raise exception 'coins_required' using errcode = '22023'; end if;
    update public.achievements
       set status = 'verified', coins_awarded = v_coins, verified_by = auth.uid(),
           verified_at = now(), review_note = p_note
     where id = a.id returning * into a;
    if v_coins > 0 then
      perform private.grant_coins(a.user_id, v_coins, 'earn', 'achievement',
                                  coalesce(a.subject, case a.type when 'ielts' then 'english'::public.subject end),
                                  a.title, auth.uid(), 'achievements', a.id);
    end if;
  else
    update public.achievements
       set status = 'rejected', verified_by = auth.uid(), verified_at = now(), review_note = p_note
     where id = a.id returning * into a;
  end if;
  return a;
end $$;

-- Teacher/admin: record a student's event result. place null = participation.
create function public.record_event_result(
  p_event uuid, p_user uuid, p_place smallint default null, p_coins integer default null
) returns public.event_results
language plpgsql security definer set search_path = '' as $$
declare
  e      public.events;
  r      public.event_results;
  v_cfg  jsonb := private.cfg('event_place_coins');
  v_coins int;
  v_used  int;
begin
  perform private.require_staff();
  select * into e from public.events where id = p_event for update;   -- serializes pool usage
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.profiles where id = p_user and role = 'student') then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  v_coins := coalesce(p_coins,
                      (v_cfg ->> p_place::text)::int,
                      (v_cfg ->> 'participation')::int,
                      0);
  if v_coins < 0 then raise exception 'invalid_amount' using errcode = '22023'; end if;

  if e.coins_pool is not null then
    select coalesce(sum(coins_awarded), 0) into v_used from public.event_results where event_id = e.id;
    if v_used + v_coins > e.coins_pool then raise exception 'pool_exhausted' using errcode = 'P0001'; end if;
  end if;

  insert into public.event_results (event_id, user_id, place, coins_awarded, recorded_by)
  values (e.id, p_user, p_place, v_coins, auth.uid())
  returning * into r;   -- unique (event_id, user_id) prevents double awards

  if v_coins > 0 then
    perform private.grant_coins(p_user, v_coins, 'earn', 'event', e.subject,
                                e.title || coalesce(' — ' || p_place || '-o''rin', ''), auth.uid(),
                                'event_results', r.id);
  end if;
  return r;
end $$;

-- Student: submit a challenge. Quizzes are auto-graded; tasks await review;
-- streaks are tracked automatically and cannot be submitted.
create function public.submit_challenge(
  p_challenge uuid, p_answer text default null, p_proof_url text default null, p_quiz_answers jsonb default null
) returns public.challenge_submissions
language plpgsql security definer set search_path = '' as $$
declare
  c       public.challenges;
  s       public.challenge_submissions;
  v_uid   uuid := auth.uid();
  v_today date := private.school_today();
  v_key   jsonb;
  v_total int;
  v_right int;
  v_score numeric;
begin
  if private.my_role() is distinct from 'student' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into c from public.challenges where id = p_challenge;
  if not found or not c.active
     or (c.starts_on is not null and c.starts_on > v_today)
     or (c.ends_on is not null and c.ends_on < v_today) then
    raise exception 'challenge_closed' using errcode = 'P0001';
  end if;
  if c.type = 'streak' then raise exception 'streak_is_automatic' using errcode = 'P0001'; end if;

  if c.recurrence = 'once' and exists (
       select 1 from public.challenge_submissions
        where challenge_id = c.id and user_id = v_uid and status in ('submitted', 'approved')) then
    raise exception 'already_submitted' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.challenge_submissions
              where challenge_id = c.id and user_id = v_uid and submitted_on = v_today) then
    raise exception 'already_submitted_today' using errcode = 'P0001';
  end if;

  if c.type = 'quiz' then
    select answers into v_key from public.challenge_answer_keys where challenge_id = c.id;
    if v_key is null then raise exception 'quiz_not_configured' using errcode = 'P0001'; end if;
    select count(*), count(*) filter (where p_quiz_answers -> k.key = k.value)
      into v_total, v_right
      from jsonb_each(v_key) k;
    v_score := round(100.0 * v_right / greatest(v_total, 1), 2);

    insert into public.challenge_submissions
      (challenge_id, user_id, status, quiz_answers, score, coins_awarded, submitted_on, reviewed_at)
    values (c.id, v_uid,
            case when v_score >= c.pass_score then 'approved' else 'rejected' end::public.submission_status,
            p_quiz_answers, v_score,
            case when v_score >= c.pass_score then c.coins_reward else 0 end,
            v_today, now())
    returning * into s;

    if s.status = 'approved' then
      if c.coins_reward > 0 then
        perform private.grant_coins(v_uid, c.coins_reward, 'earn', 'challenge', c.subject, c.title,
                                    null, 'challenge_submissions', s.id);
      end if;
      perform private.evaluate_streaks(v_uid, c.subject);
    end if;
  else
    insert into public.challenge_submissions (challenge_id, user_id, answer, proof_url, submitted_on)
    values (c.id, v_uid, p_answer, p_proof_url, v_today)
    returning * into s;
  end if;
  return s;
end $$;

-- Teacher: review a task submission.
create function public.review_submission(
  p_submission uuid, p_approve boolean, p_score numeric default null, p_coins integer default null
) returns public.challenge_submissions
language plpgsql security definer set search_path = '' as $$
declare
  s public.challenge_submissions;
  c public.challenges;
  v_coins int;
begin
  perform private.require_staff();
  select * into s from public.challenge_submissions where id = p_submission for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if s.status <> 'submitted' then raise exception 'already_reviewed' using errcode = 'P0001'; end if;
  select * into c from public.challenges where id = s.challenge_id;

  v_coins := case when p_approve then coalesce(p_coins, c.coins_reward) else 0 end;
  if v_coins < 0 or v_coins > c.coins_reward * 2 then   -- bonus up to 2× allowed
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  update public.challenge_submissions
     set status = case when p_approve then 'approved' else 'rejected' end::public.submission_status,
         score = p_score, coins_awarded = v_coins, reviewed_by = auth.uid(), reviewed_at = now()
   where id = s.id returning * into s;

  if p_approve then
    if v_coins > 0 then
      perform private.grant_coins(s.user_id, v_coins, 'earn', 'challenge', c.subject, c.title,
                                  auth.uid(), 'challenge_submissions', s.id);
    end if;
    perform private.evaluate_streaks(s.user_id, c.subject);
  end if;
  return s;
end $$;

-- Student: redeem a shop item. Coins are deducted immediately (held);
-- a rejected order is refunded. Small items may auto-approve via config.
create function public.redeem_item(p_item uuid) returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  i     public.shop_items;
  o     public.orders;
  v_uid uuid := auth.uid();
  v_bal int;
  v_max_pending int := private.cfg_int('shop', '{max_pending_orders}');
begin
  if private.my_role() is distinct from 'student' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into i from public.shop_items where id = p_item and active for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if i.stock <= 0 then raise exception 'out_of_stock' using errcode = 'P0001'; end if;

  select coin_balance into v_bal from public.profiles where id = v_uid for update;
  if v_bal < i.coin_price then raise exception 'insufficient_coins' using errcode = 'P0001'; end if;

  if v_max_pending is not null and (
       select count(*) from public.orders where user_id = v_uid and status = 'pending') >= v_max_pending then
    raise exception 'too_many_pending_orders' using errcode = 'P0001';
  end if;

  insert into public.orders (user_id, item_id, coin_cost, status)
  values (v_uid, i.id, i.coin_price,
          case when i.tier = 'small' and coalesce((private.cfg('shop') ->> 'auto_approve_small')::boolean, false)
               then 'approved' else 'pending' end::public.order_status)
  returning * into o;

  perform private.grant_coins(v_uid, i.coin_price, 'spend', 'purchase', null, i.name, null, 'orders', o.id);
  update public.shop_items set stock = stock - 1 where id = i.id;
  return o;
end $$;

-- Admin: move an order through pending → approved → delivered, or reject (refund + restock).
create function public.review_order(p_order uuid, p_status public.order_status, p_note text default null)
returns public.orders
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
begin
  perform private.require_admin();
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;

  if not (   (o.status = 'pending'  and p_status in ('approved', 'rejected'))
          or (o.status = 'approved' and p_status in ('delivered', 'rejected'))) then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  update public.orders
     set status = p_status, reviewed_by = auth.uid(), reviewed_at = now(), note = coalesce(p_note, note)
   where id = o.id returning * into o;

  if p_status = 'rejected' then
    perform private.grant_coins(o.user_id, o.coin_cost, 'earn', 'purchase', null,
                                'Qaytarildi: ' || coalesce(p_note, 'buyurtma rad etildi'),
                                auth.uid(), 'orders', o.id);
    update public.shop_items set stock = stock + 1 where id = o.item_id;
  end if;
  return o;
end $$;

-- ───────────────────────────── Leaderboards ─────────────────────────────
-- Rating points = coins EARNED (class activity, challenges, achievements,
-- events, positive adjustments) minus discipline penalties. Shopping and
-- refunds don't affect rank, so spending never costs you your place.
--
-- These views run as their owner (security_invoker = off) on purpose:
-- students can't read each other's ledgers, but may see aggregated points.
-- Only safe columns are exposed.

create view public.rating_points with (security_invoker = off) as
  select t.user_id, t.subject,
         sum(case when t.direction = 'earn' then t.amount else -t.amount end)::integer as points
    from public.coin_transactions t
   where t.category <> 'purchase'
   group by t.user_id, t.subject;

create view public.leaderboard_overall with (security_invoker = off) as
  select p.id as user_id, p.full_name, p.avatar_url, p.class_id, c.name as class_name,
         coalesce(sum(rp.points), 0)::integer as points,
         rank() over (order by coalesce(sum(rp.points), 0) desc)::integer as school_rank,
         rank() over (partition by p.class_id order by coalesce(sum(rp.points), 0) desc)::integer as class_rank
    from public.profiles p
    left join public.classes c on c.id = p.class_id
    left join public.rating_points rp on rp.user_id = p.id
   where p.role = 'student'
   group by p.id, c.name;

create view public.leaderboard_subject with (security_invoker = off) as
  select p.id as user_id, p.full_name, p.avatar_url, p.class_id, c.name as class_name, s.subject,
         coalesce(rp.points, 0)::integer as points,
         rank() over (partition by s.subject order by coalesce(rp.points, 0) desc)::integer as school_rank,
         rank() over (partition by s.subject, p.class_id order by coalesce(rp.points, 0) desc)::integer as class_rank
    from public.profiles p
   cross join unnest(enum_range(null::public.subject)) as s(subject)
    left join public.classes c on c.id = p.class_id
    left join public.rating_points rp on rp.user_id = p.id and rp.subject = s.subject
   where p.role = 'student';

-- Class vs class (total points per class).
create view public.leaderboard_classes with (security_invoker = off) as
  select c.id as class_id, c.name, c.grade,
         count(distinct p.id)::integer as students,
         coalesce(sum(rp.points), 0)::integer as points,
         rank() over (order by coalesce(sum(rp.points), 0) desc)::integer as rank
    from public.classes c
    left join public.profiles p on p.class_id = c.id and p.role = 'student'
    left join public.rating_points rp on rp.user_id = p.id
   group by c.id;

-- ───────────────────────────── RLS ─────────────────────────────

alter table public.classes               enable row level security;
alter table public.profiles              enable row level security;
alter table public.coin_transactions     enable row level security;
alter table public.achievements          enable row level security;
alter table public.events                enable row level security;
alter table public.event_results         enable row level security;
alter table public.challenges            enable row level security;
alter table public.challenge_answer_keys enable row level security;
alter table public.challenge_submissions enable row level security;
alter table public.shop_items            enable row level security;
alter table public.orders                enable row level security;
alter table public.app_config            enable row level security;
alter table public.announcements         enable row level security;
alter table public.push_tokens           enable row level security;

-- classes
create policy "classes: read"        on public.classes for select to authenticated using (true);
create policy "classes: admin write" on public.classes for all    to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- profiles (everyone signed in can see names/avatars/balances for leaderboards)
create policy "profiles: read"       on public.profiles for select to authenticated using (true);
create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles: admin update" on public.profiles for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy "profiles: admin delete" on public.profiles for delete to authenticated
  using (private.is_admin());
-- Column privileges: coin_balance is never client-writable.
revoke insert, update on public.profiles from anon, authenticated;
grant update (full_name, avatar_url, role, class_id) on public.profiles to authenticated;

-- coin_transactions: read-only from the client. No insert/update/delete policies.
create policy "coin_tx: read own or staff" on public.coin_transactions for select to authenticated
  using (user_id = auth.uid() or private.is_staff());
revoke insert, update, delete on public.coin_transactions from anon, authenticated;

-- achievements: students submit their own (pending, zero coins); verified ones are public.
create policy "achievements: read" on public.achievements for select to authenticated
  using (user_id = auth.uid() or status = 'verified' or private.is_staff());
create policy "achievements: submit own" on public.achievements for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and coins_awarded = 0
              and verified_by is null and verified_at is null);
create policy "achievements: delete own pending" on public.achievements for delete to authenticated
  using (user_id = auth.uid() and status = 'pending');
revoke update on public.achievements from anon, authenticated;   -- reviews go through review_achievement()

-- events
create policy "events: read"        on public.events for select to authenticated using (true);
create policy "events: admin write" on public.events for all    to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- event_results: public; written only by record_event_result()
create policy "event_results: read" on public.event_results for select to authenticated using (true);
revoke insert, update, delete on public.event_results from anon, authenticated;

-- challenges: students see active ones; teachers manage their own; admins manage all.
create policy "challenges: read" on public.challenges for select to authenticated
  using (active or private.is_staff());
create policy "challenges: staff insert" on public.challenges for insert to authenticated
  with check (private.is_staff() and created_by = auth.uid());
create policy "challenges: owner or admin update" on public.challenges for update to authenticated
  using (private.is_admin() or (private.is_staff() and created_by = auth.uid()))
  with check (private.is_admin() or (private.is_staff() and created_by = auth.uid()));
create policy "challenges: owner or admin delete" on public.challenges for delete to authenticated
  using (private.is_admin() or (private.is_staff() and created_by = auth.uid()));

create policy "answer_keys: staff" on public.challenge_answer_keys for all to authenticated
  using (private.is_admin() or exists (
           select 1 from public.challenges c where c.id = challenge_id and c.created_by = auth.uid() and private.is_staff()))
  with check (private.is_admin() or exists (
           select 1 from public.challenges c where c.id = challenge_id and c.created_by = auth.uid() and private.is_staff()));

-- submissions: written only by submit_challenge() / review_submission()
create policy "submissions: read own or staff" on public.challenge_submissions for select to authenticated
  using (user_id = auth.uid() or private.is_staff());
revoke insert, update, delete on public.challenge_submissions from anon, authenticated;

-- shop
create policy "shop: read"        on public.shop_items for select to authenticated using (active or private.is_admin());
create policy "shop: admin write" on public.shop_items for all    to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- orders: written only by redeem_item() / review_order()
create policy "orders: read own or admin" on public.orders for select to authenticated
  using (user_id = auth.uid() or private.is_admin());
revoke insert, update, delete on public.orders from anon, authenticated;

-- app_config: readable (UI shows goals/prices); admin-writable
create policy "config: read"        on public.app_config for select to authenticated using (true);
create policy "config: admin write" on public.app_config for all    to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- announcements
create policy "announcements: read"        on public.announcements for select to authenticated using (true);
create policy "announcements: staff write" on public.announcements for all    to authenticated
  using (private.is_staff()) with check (private.is_staff());

-- push tokens: own device rows only
create policy "push_tokens: own" on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Nothing is readable anonymously.
revoke all on all tables in schema public from anon;
revoke select on public.rating_points, public.leaderboard_overall, public.leaderboard_subject,
                 public.leaderboard_classes from anon;
grant select on public.rating_points, public.leaderboard_overall, public.leaderboard_subject,
                public.leaderboard_classes to authenticated;

-- RPC execute privileges: signed-in users only (each function checks role itself).
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.award_class_activity(uuid[], public.subject, integer, text),
  public.penalize_student(uuid, integer, text),
  public.admin_adjust_coins(uuid, integer, text),
  public.suggest_achievement_coins(public.achievement_type, numeric, public.olympiad_level),
  public.review_achievement(uuid, boolean, integer, text),
  public.record_event_result(uuid, uuid, smallint, integer),
  public.submit_challenge(uuid, text, text, jsonb),
  public.review_submission(uuid, boolean, numeric, integer),
  public.redeem_item(uuid),
  public.review_order(uuid, public.order_status, text)
to authenticated;

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_admin(), private.is_staff(), private.my_role() to authenticated;

-- ───────────────────────────── Storage ─────────────────────────────
insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', true),
  ('shop',    'shop',    true),
  ('proofs',  'proofs',  false)    -- certificates / task proofs: owner + staff only
on conflict (id) do nothing;

-- Files are stored under "<user_id>/<filename>".
create policy "avatars: read"         on storage.objects for select to authenticated using (bucket_id = 'avatars');
create policy "avatars: write own"    on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: update own"   on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: delete own"   on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "shop: read"            on storage.objects for select to authenticated using (bucket_id = 'shop');
create policy "shop: admin write"     on storage.objects for all to authenticated
  using (bucket_id = 'shop' and private.is_admin()) with check (bucket_id = 'shop' and private.is_admin());

create policy "proofs: read own or staff" on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and ((storage.foldername(name))[1] = auth.uid()::text or private.is_staff()));
create policy "proofs: write own"     on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);

-- ───────────────────────────── Realtime ─────────────────────────────
-- Leaderboard views refetch when profiles.coin_balance changes; students get
-- live balance/order updates. Realtime respects the RLS policies above.
alter publication supabase_realtime add table
  public.profiles, public.coin_transactions, public.orders, public.event_results, public.announcements;

-- ───────────────────────── Default coin economy ─────────────────────────
-- Calibration (≈170 school days/year → 1.5 years ≈ 255 days):
--   Average student/day: class activity ~15 + challenges ~20 + events ~5 ≈ 40
--   40 × 255 ≈ 10 200 coins  → MacBook-tier prize priced at 10 000.
--   High achiever: ~60/day + IELTS 7.5 (3000) + national olympiad (4000)
--   → reaches 10 000 in ~6–9 months.
insert into public.app_config (key, value, description) values
  ('timezone',              '"Asia/Tashkent"', 'Maktab vaqt mintaqasi (kunlik limitlar uchun)'),
  ('big_goal',              '{"title": "MacBook Air", "coins": 10000, "item_id": null}', 'Bosh sahifadagi katta maqsad'),
  ('class_activity',        '{"default": 5, "max_per_award": 20, "daily_cap_per_student": 30}', 'Darsdagi faollik uchun coinlar'),
  ('penalty',               '{"max_per_action": 50}', 'Intizom buzilishi uchun maksimal jarima'),
  ('challenge_defaults',    '{"daily_task": 10, "quiz": 15, "weekly_task": 40, "streak_7": 100}', 'Yangi vazifalar uchun tavsiya etilgan mukofotlar'),
  ('streak_skip_weekdays',  '[0]', 'Seriyani buzmaydigan kunlar (0 = yakshanba)'),
  ('event_place_coins',     '{"1": 300, "2": 200, "3": 120, "participation": 30}', 'Tadbirlarda o''rin uchun coinlar'),
  ('achievement_coins', '{
     "ielts":         [{"min": 5.5, "coins": 800}, {"min": 6.0, "coins": 1200}, {"min": 6.5, "coins": 1800}, {"min": 7.0, "coins": 2400}, {"min": 7.5, "coins": 3000}, {"min": 8.0, "coins": 4000}],
     "sat":           [{"min": 1200, "coins": 1000}, {"min": 1300, "coins": 1600}, {"min": 1400, "coins": 2400}, {"min": 1500, "coins": 3500}],
     "national_cert": [{"min": 60, "coins": 800}, {"min": 70, "coins": 1200}, {"min": 80, "coins": 1800}, {"min": 90, "coins": 2500}],
     "olympiad": {
       "school":        {"1": 200,  "2": 120,  "3": 80,   "participant": 20},
       "district":      {"1": 600,  "2": 400,  "3": 250,  "participant": 50},
       "region":        {"1": 1500, "2": 1000, "3": 700,  "participant": 100},
       "national":      {"1": 4000, "2": 3000, "3": 2000, "participant": 300},
       "international": {"1": 8000, "2": 6000, "3": 4500, "participant": 1000}
     }
   }', 'Yutuqlar uchun coinlar (admin tasdiqlaganda tavsiya etiladi)'),
  ('shop',                  '{"auto_approve_small": false, "max_pending_orders": 3}', 'Do''kon sozlamalari')
on conflict (key) do nothing;
