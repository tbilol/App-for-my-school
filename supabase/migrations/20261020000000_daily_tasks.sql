-- ═══════════════════════════════════════════════════════════════════════════
--  Zamin Students — daily tasks engine + streaks (phase 2a, backend only)
--
--  A NEW subsystem, separate from `challenges` (which, with evaluate_streaks,
--  is left untouched):
--   • levels / student_levels — per-subject proficiency; teachers set a student's level;
--   • task_bank (+ staff-only task_bank_keys) — the item pool per subject + level;
--   • daily_sets / daily_items — one set per student, subject and school day,
--     ≤ set_size items sampled from the pool by skill weight, avoiding recent repeats.
--     Items snapshot the bank row and never carry the answer;
--   • student_streaks — per-subject + overall (subject null) streaks of
--     on-time completed sets. Streaks are tracked and shown only — they pay no coins.
--
--  "Today" = private.school_today(); skip days = app_config.streak_skip_weekdays.
--  Coins go through private.grant_coins with category 'challenge'.
--  Students write nothing directly: every write is a security-definer RPC.
--
--  Forward-only; applies on top of 20261019000100_super_admin.sql.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────── Enums ─────────────────────────────
create type public.task_skill        as enum ('grammar', 'reading', 'writing', 'math', 'it');
create type public.answer_mode       as enum ('choice', 'exact', 'text');   -- choice/exact auto-graded, text teacher-reviewed
create type public.daily_set_status  as enum ('pending', 'completed');
create type public.daily_item_status as enum ('pending', 'answered', 'approved', 'rejected');

-- ───────────────────────────── Tables ─────────────────────────────

-- Admin-managed proficiency levels, per subject (English A1/A2/B1, Math 1/2/3 …).
create table public.levels (
  id         uuid primary key default gen_random_uuid(),
  subject    public.subject not null,
  ord        smallint not null,
  name       text not null check (btrim(name) <> ''),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (subject, ord),
  unique (id, subject)              -- target of the (level_id, subject) FKs below
);
create unique index levels_subject_name_key on public.levels (subject, lower(name));

-- A student's current level per subject. The composite FK guarantees the level
-- belongs to that subject.
create table public.student_levels (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  subject    public.subject not null,
  level_id   uuid not null,
  set_by     uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (user_id, subject),
  foreign key (level_id, subject) references public.levels (id, subject) on delete restrict
);
create index student_levels_level_idx on public.student_levels (level_id);

-- The item pool. body: {"options": ["…", "…"]} for choice; free-form otherwise.
-- The answer is NOT here — see task_bank_keys.
create table public.task_bank (
  id          uuid primary key default gen_random_uuid(),
  subject     public.subject not null,
  level_id    uuid not null,
  skill       public.task_skill not null,
  answer_mode public.answer_mode not null,
  prompt      text not null check (btrim(prompt) <> ''),
  body        jsonb not null default '{}'::jsonb,
  difficulty  smallint not null default 1 check (difficulty between 1 and 5),
  active      boolean not null default true,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  foreign key (level_id, subject) references public.levels (id, subject) on delete restrict,
  check (answer_mode <> 'choice' or case when jsonb_typeof(body -> 'options') = 'array'
                                         then jsonb_array_length(body -> 'options') >= 2 else false end)
);
create index task_bank_pool_idx on public.task_bank (subject, level_id, skill) where active;

-- Staff-only answer keys (same idea as challenge_answer_keys).
--   choice: {"correct": 2}  (option index; an array allows several right options)
--   exact:  {"value": "42"} or {"values": ["42", "forty-two"]}  (case/space-insensitive; numbers compared numerically)
--   text:   no key needed (teacher-reviewed)
create table public.task_bank_keys (
  task_id uuid primary key references public.task_bank (id) on delete cascade,
  answer  jsonb not null
);

create table public.daily_sets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  subject      public.subject not null,
  set_date     date not null,                    -- school-local date
  status       public.daily_set_status not null default 'pending',
  on_time      boolean,                          -- set at completion: completed on set_date itself
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (user_id, subject, set_date)
);
create index daily_sets_user_date_idx on public.daily_sets (user_id, set_date desc);

-- Snapshot of the bank row at generation time, so history survives bank edits.
-- Students can read these rows: the correct answer is NEVER stored here.
-- A served bank item can't be deleted (restrict) — deactivate it instead.
create table public.daily_items (
  id             uuid primary key default gen_random_uuid(),
  set_id         uuid not null references public.daily_sets (id) on delete cascade,
  task_id        uuid not null references public.task_bank (id) on delete restrict,
  ord            smallint not null,
  skill          public.task_skill not null,
  answer_mode    public.answer_mode not null,
  prompt         text not null,
  body           jsonb not null default '{}'::jsonb,
  status         public.daily_item_status not null default 'pending',
  student_answer jsonb,
  is_correct     boolean,
  coins_awarded  integer not null default 0 check (coins_awarded >= 0),
  reviewed_by    uuid references public.profiles (id) on delete set null,
  reviewed_at    timestamptz,
  answered_at    timestamptz,
  unique (set_id, ord)
);
create index daily_items_task_idx   on public.daily_items (task_id);
create index daily_items_review_idx on public.daily_items (status) where answer_mode = 'text' and status = 'answered';

-- One row per (student, subject) plus one overall row (subject null).
create table public.student_streaks (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  subject           public.subject,              -- null = overall (all subjects on time that day)
  current_streak    integer not null default 0 check (current_streak >= 0),
  longest_streak    integer not null default 0 check (longest_streak >= 0),
  last_completed_on date,
  updated_at        timestamptz not null default now()
);
create unique index student_streaks_subject_key on public.student_streaks (user_id, subject) where subject is not null;
create unique index student_streaks_overall_key on public.student_streaks (user_id) where subject is null;

-- ─────────────────────────── Private helpers ───────────────────────────

-- Not a skip day (app_config.streak_skip_weekdays, default Sunday — as evaluate_streaks).
create function private.is_school_day(p_day date) returns boolean
language sql stable security definer set search_path = '' as $$
  select not (extract(dow from p_day)::int = any (coalesce(
    (select array_agg(x::int) from jsonb_array_elements_text(private.cfg('streak_skip_weekdays')) x),
    array[0])))
$$;

-- The school day before p_day.
create function private.prev_school_day(p_day date) returns date
language plpgsql stable security definer set search_path = '' as $$
declare v date := p_day - 1;
begin
  for i in 1..7 loop
    exit when private.is_school_day(v);
    v := v - 1;
  end loop;
  return v;
end $$;

-- Exact-answer comparison: trimmed, case- and space-insensitive; numbers
-- compare numerically ("3,5" = "3.50").
create function private.exact_match(p_expected text, p_given text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  e text := lower(regexp_replace(btrim(coalesce(p_expected, '')), '\s+', ' ', 'g'));
  g text := lower(regexp_replace(btrim(coalesce(p_given, '')), '\s+', ' ', 'g'));
  num constant text := '^[-+]?([0-9]+([.][0-9]*)?|[.][0-9]+)$';
begin
  if e = '' or g = '' then return false; end if;
  if replace(e, ',', '.') ~ num and replace(g, ',', '.') ~ num then
    return replace(e, ',', '.')::numeric = replace(g, ',', '.')::numeric;
  end if;
  return e = g;
end $$;

-- Was p_day counted for this streak? Subject: that set completed on time.
-- Overall (p_subject null): every subject's set completed on time that day.
create function private.daily_streak_day(p_user uuid, p_subject public.subject, p_day date) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when p_subject is not null then exists (
      select 1 from public.daily_sets
       where user_id = p_user and subject = p_subject and set_date = p_day
         and status = 'completed' and on_time)
    else (select count(distinct subject) from public.daily_sets
           where user_id = p_user and set_date = p_day and status = 'completed' and on_time)
         = cardinality(enum_range(null::public.subject))
  end
$$;

-- Recompute one streak row from daily_sets. Counts back from the most recent
-- school day (today if already done, else yesterday) while each school day
-- counts. Tracking only: no coins.
create function private.recompute_daily_streak(p_user uuid, p_subject public.subject) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_day   date := private.school_today();
  v_count int := 0;
  v_last  date;
begin
  if not private.is_school_day(v_day) then v_day := private.prev_school_day(v_day); end if;
  if not private.daily_streak_day(p_user, p_subject, v_day) then v_day := private.prev_school_day(v_day); end if;
  while private.daily_streak_day(p_user, p_subject, v_day) loop
    v_last := coalesce(v_last, v_day);
    v_count := v_count + 1;
    v_day := private.prev_school_day(v_day);
  end loop;

  insert into public.student_streaks (user_id, subject) values (p_user, p_subject) on conflict do nothing;
  update public.student_streaks
     set current_streak    = v_count,
         longest_streak    = greatest(longest_streak, v_count),
         last_completed_on = coalesce(v_last, last_completed_on),
         updated_at        = now()
   where user_id = p_user and subject is not distinct from p_subject;
end $$;

create function private.recompute_subject_streak(p_user uuid, p_subject public.subject) returns void
language sql security definer set search_path = '' as $$
  select private.recompute_daily_streak(p_user, p_subject)
$$;

create function private.recompute_overall_streak(p_user uuid) returns void
language sql security definer set search_path = '' as $$
  select private.recompute_daily_streak(p_user, null)
$$;

-- Rollover: zero every streak whose last counted day is older than the school
-- day before p_date (a school day was missed). Returns rows reset.
create function private.reset_broken_streaks(p_date date) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_prev date := private.prev_school_day(p_date);
  v_n    int;
begin
  update public.student_streaks
     set current_streak = 0, updated_at = now()
   where current_streak > 0 and (last_completed_on is null or last_completed_on < v_prev);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ───────────────────────────── RPCs ─────────────────────────────

-- Staff: set (or, with p_level null, clear) a student's level in a subject.
-- Takes effect from the next generated set.
create function public.set_student_level(p_student uuid, p_subject public.subject, p_level uuid)
returns public.student_levels
language plpgsql security definer set search_path = '' as $$
declare r public.student_levels;
begin
  perform private.require_staff();
  if not exists (select 1 from public.profiles where id = p_student and role = 'student') then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform private.require_manage_student(p_student);
  if p_level is null then
    delete from public.student_levels where user_id = p_student and subject = p_subject returning * into r;
    return r;
  end if;
  if not exists (select 1 from public.levels where id = p_level and subject = p_subject and active) then
    raise exception 'invalid_level' using errcode = '22023';
  end if;
  insert into public.student_levels (user_id, subject, level_id, set_by, updated_at)
  values (p_student, p_subject, p_level, auth.uid(), now())
  on conflict (user_id, subject) do update
     set level_id = excluded.level_id, set_by = excluded.set_by, updated_at = now()
  returning * into r;
  return r;
end $$;

-- Cron (no JWT) or admin: create the day's sets. Idempotent; returns sets created.
-- Never for a future date; nothing on skip days (but streak rollover still runs).
create function public.generate_daily_sets(p_date date default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_date    date := coalesce(p_date, private.school_today());
  v_size    int  := coalesce(private.cfg_int('daily', '{set_size}'), 10);
  v_avoid   int  := coalesce(private.cfg_int('daily', '{avoid_recent_days}'), 14);
  v_weights jsonb;
  v_recent  uuid[];
  v_set     uuid;
  v_created int := 0;
  s         record;
begin
  if auth.uid() is not null and not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_date > private.school_today() then return 0; end if;
  perform private.reset_broken_streaks(v_date);
  if not private.is_school_day(v_date) then return 0; end if;

  for s in
    select sl.user_id, sl.subject, sl.level_id
      from public.student_levels sl
      join public.profiles p on p.id = sl.user_id and p.role = 'student'
     where not exists (select 1 from public.daily_sets d
                        where d.user_id = sl.user_id and d.subject = sl.subject and d.set_date = v_date)
  loop
    -- skill weights for the subject; no config → every skill weight 1; weight ≤ 0 → never served
    v_weights := private.cfg('daily') -> 'weights' -> s.subject::text;
    continue when not exists (
      select 1 from public.task_bank t
       where t.subject = s.subject and t.level_id = s.level_id and t.active
         and coalesce((v_weights ->> t.skill::text)::numeric, case when v_weights is null then 1 else 0 end) > 0);

    insert into public.daily_sets (user_id, subject, set_date) values (s.user_id, s.subject, v_date)
    on conflict (user_id, subject, set_date) do nothing
    returning id into v_set;
    continue when v_set is null;

    v_recent := array(
      select di.task_id from public.daily_items di
        join public.daily_sets ds on ds.id = di.set_id
       where ds.user_id = s.user_id and ds.subject = s.subject
         and ds.set_date >= v_date - v_avoid and ds.set_date < v_date);

    -- Slots per skill by Sainte-Laguë apportionment of the weights (6:3:1 → 6/3/1
    -- of 10), capped by what the pool has. Not-recently-served items fill slots
    -- first; recent ones only once those run out.
    insert into public.daily_items (set_id, task_id, ord, skill, answer_mode, prompt, body)
    select v_set, x.id, row_number() over (order by x.slot), x.skill, x.answer_mode, x.prompt, x.body
      from (
        select r.*, (r.k - 0.5) / r.w + case when r.recent then 1e6 else 0 end as slot
          from (
            select t.id, t.skill, t.answer_mode, t.prompt, t.body, w.w,
                   t.id = any (v_recent) as recent,
                   row_number() over (partition by t.skill order by t.id = any (v_recent), random()) as k
              from public.task_bank t
             cross join lateral (select coalesce((v_weights ->> t.skill::text)::numeric,
                                                 case when v_weights is null then 1 else 0 end) as w) w
             where t.subject = s.subject and t.level_id = s.level_id and t.active and w.w > 0
          ) r
         order by slot, random()
         limit v_size
      ) x;

    v_created := v_created + 1;
  end loop;
  return v_created;
end $$;

-- Student: answer one item of their own set.
--   choice → p_answer {"choice": <option index>}   (auto-graded)
--   exact  → p_answer {"value": "<text or number>"} (auto-graded)
--   text   → p_answer {"text": "<essay>"}           (awaits review_daily_item)
-- When no item is left pending the set completes; on time (same school day)
-- it pays the completion bonus and advances the streaks.
create function public.submit_daily_item(p_item uuid, p_answer jsonb) returns public.daily_items
language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_today date := private.school_today();
  st      public.daily_sets;
  it      public.daily_items;
  v_key   jsonb;
  v_given jsonb;
  v_ok    boolean;
  v_coins int := 0;
  v_bonus int;
begin
  if private.my_role() is distinct from 'student' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- lock the set first: serializes completion of one set
  select s.* into st from public.daily_sets s
   where s.id = (select set_id from public.daily_items where id = p_item) for update;
  if not found or st.user_id <> v_uid then raise exception 'not_found' using errcode = 'P0002'; end if;
  select * into it from public.daily_items where id = p_item for update;
  if it.status <> 'pending' then raise exception 'already_answered' using errcode = 'P0001'; end if;
  if st.set_date > v_today then raise exception 'not_open' using errcode = 'P0001'; end if;

  if it.answer_mode = 'text' then
    v_given := p_answer -> 'text';
    if jsonb_typeof(v_given) is distinct from 'string' or btrim(v_given #>> '{}') = '' then
      raise exception 'answer_required' using errcode = '22023';
    end if;
    if length(v_given #>> '{}') > 5000 then raise exception 'answer_too_long' using errcode = '22023'; end if;
    update public.daily_items
       set student_answer = jsonb_build_object('text', btrim(v_given #>> '{}')),
           status = 'answered', answered_at = now()
     where id = it.id returning * into it;
  else
    select answer into v_key from public.task_bank_keys where task_id = it.task_id;
    if v_key is null then raise exception 'task_not_configured' using errcode = 'P0001'; end if;

    if it.answer_mode = 'choice' then
      v_given := p_answer -> 'choice';
      if jsonb_typeof(v_given) is distinct from 'number' then
        raise exception 'answer_required' using errcode = '22023';
      end if;
      v_ok := coalesce(case when jsonb_typeof(v_key -> 'correct') = 'array'
                            then (v_key -> 'correct') @> jsonb_build_array(v_given)
                            else (v_key -> 'correct') = v_given end, false);
      v_given := jsonb_build_object('choice', v_given);
    else  -- exact
      v_given := p_answer -> 'value';
      if coalesce(jsonb_typeof(v_given), '') not in ('string', 'number') or btrim(v_given #>> '{}') = '' then
        raise exception 'answer_required' using errcode = '22023';
      end if;
      v_ok := exists (
        select 1 from jsonb_array_elements(case when jsonb_typeof(v_key -> 'values') = 'array' then v_key -> 'values'
                                                else jsonb_build_array(v_key -> 'value') end) a
         where private.exact_match(a #>> '{}', v_given #>> '{}'));
      v_given := jsonb_build_object('value', v_given);
    end if;

    if v_ok then v_coins := greatest(coalesce(private.cfg_int('daily', '{coins_per_correct}'), 0), 0); end if;
    update public.daily_items
       set student_answer = v_given, is_correct = v_ok, coins_awarded = v_coins,
           status = 'answered', answered_at = now()
     where id = it.id returning * into it;
    if v_coins > 0 then
      perform private.grant_coins(v_uid, v_coins, 'earn', 'challenge', st.subject,
                                  'Kunlik vazifa: to''g''ri javob', null, 'daily_items', it.id);
    end if;
  end if;

  if not exists (select 1 from public.daily_items where set_id = st.id and status = 'pending') then
    update public.daily_sets
       set status = 'completed', completed_at = now(), on_time = (set_date = v_today)
     where id = st.id returning * into st;
    if st.on_time then
      v_bonus := coalesce(private.cfg_int('daily', '{completion_bonus}'), 0);
      if v_bonus > 0 then
        perform private.grant_coins(v_uid, v_bonus, 'earn', 'challenge', st.subject,
                                    'Kunlik vazifa: to''plam bajarildi', null, 'daily_sets', st.id);
      end if;
    end if;
    perform private.recompute_subject_streak(v_uid, st.subject);
    perform private.recompute_overall_streak(v_uid);
  end if;
  return it;
end $$;

-- Staff: review a written (answer_mode 'text') item. Approve pays p_coins
-- (default daily.writing_default_coins, at most daily.writing_max_coins).
-- Set completion and streaks already happened when the student answered.
create function public.review_daily_item(
  p_item uuid, p_status public.daily_item_status, p_coins integer default null
) returns public.daily_items
language plpgsql security definer set search_path = '' as $$
declare
  it      public.daily_items;
  st      public.daily_sets;
  v_max   int := coalesce(private.cfg_int('daily', '{writing_max_coins}'), 10);
  v_coins int := 0;
begin
  perform private.require_staff();
  select * into it from public.daily_items where id = p_item for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  select * into st from public.daily_sets where id = it.set_id;
  perform private.require_manage_student(st.user_id);
  if it.answer_mode <> 'text' then raise exception 'not_reviewable' using errcode = 'P0001'; end if;
  if it.status = 'pending' then raise exception 'not_answered' using errcode = 'P0001'; end if;
  if it.status <> 'answered' then raise exception 'already_reviewed' using errcode = 'P0001'; end if;
  if p_status is null or p_status not in ('approved', 'rejected') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;

  if p_status = 'approved' then
    v_coins := coalesce(p_coins, private.cfg_int('daily', '{writing_default_coins}'), v_max);
    if v_coins < 0 or v_coins > v_max then raise exception 'invalid_amount' using errcode = '22023'; end if;
  end if;

  update public.daily_items
     set status = p_status, is_correct = (p_status = 'approved'), coins_awarded = v_coins,
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = it.id returning * into it;
  if v_coins > 0 then
    perform private.grant_coins(st.user_id, v_coins, 'earn', 'challenge', st.subject,
                                'Kunlik vazifa: yozma ish tasdiqlandi', auth.uid(), 'daily_items', it.id);
  end if;
  return it;
end $$;

-- ───────────────────────────── RLS ─────────────────────────────
alter table public.levels          enable row level security;
alter table public.student_levels  enable row level security;
alter table public.task_bank       enable row level security;
alter table public.task_bank_keys  enable row level security;
alter table public.daily_sets      enable row level security;
alter table public.daily_items     enable row level security;
alter table public.student_streaks enable row level security;

revoke all on public.levels, public.student_levels, public.task_bank, public.task_bank_keys,
              public.daily_sets, public.daily_items, public.student_streaks from anon;

create policy "levels: read active" on public.levels for select to authenticated
  using (active or private.is_admin());
create policy "levels: admin write" on public.levels for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- student_levels: written only by set_student_level()
create policy "student_levels: read own or managed" on public.student_levels for select to authenticated
  using (user_id = auth.uid() or private.can_manage_student(user_id));
revoke insert, update, delete on public.student_levels from authenticated;

-- task_bank / keys: staff read, admin write. Students: no access at all.
create policy "task_bank: staff read" on public.task_bank for select to authenticated
  using (private.is_staff());
create policy "task_bank: admin write" on public.task_bank for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy "task_bank_keys: staff read" on public.task_bank_keys for select to authenticated
  using (private.is_staff());
create policy "task_bank_keys: admin write" on public.task_bank_keys for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- daily sets/items/streaks: own, teacher's students, parent's children, admin.
-- Written only by the RPCs above.
create policy "daily_sets: read scoped" on public.daily_sets for select to authenticated
  using (private.can_view_member(user_id));
create policy "daily_items: read scoped" on public.daily_items for select to authenticated
  using (exists (select 1 from public.daily_sets s where s.id = set_id and private.can_view_member(s.user_id)));
create policy "student_streaks: read scoped" on public.student_streaks for select to authenticated
  using (private.can_view_member(user_id));
revoke insert, update, delete on public.daily_sets, public.daily_items, public.student_streaks from authenticated;

-- ───────────────────────────── Config ─────────────────────────────
insert into public.app_config (key, value, description) values
  ('daily', '{
     "set_size": 10, "coins_per_correct": 2, "completion_bonus": 10, "avoid_recent_days": 14,
     "writing_max_coins": 10, "writing_default_coins": 5,
     "weights": {"english": {"grammar": 6, "reading": 3, "writing": 1}, "math": {"math": 10}, "it": {"it": 10}}
   }', 'Kunlik vazifalar: to''plam hajmi, coinlar, takrorlanmaslik muddati, ko''nikmalar ulushi')
on conflict (key) do nothing;

-- ───────────────────────────── Privileges ─────────────────────────────
revoke execute on function
  private.is_school_day(date), private.prev_school_day(date), private.exact_match(text, text),
  private.daily_streak_day(uuid, public.subject, date), private.recompute_daily_streak(uuid, public.subject),
  private.recompute_subject_streak(uuid, public.subject), private.recompute_overall_streak(uuid),
  private.reset_broken_streaks(date)
from public, anon, authenticated;

revoke execute on function
  public.set_student_level(uuid, public.subject, uuid), public.generate_daily_sets(date),
  public.submit_daily_item(uuid, jsonb), public.review_daily_item(uuid, public.daily_item_status, integer)
from public, anon;
grant execute on function
  public.set_student_level(uuid, public.subject, uuid), public.generate_daily_sets(date),
  public.submit_daily_item(uuid, jsonb), public.review_daily_item(uuid, public.daily_item_status, integer)
to authenticated;

-- ───────────────────────────── Schedule ─────────────────────────────
-- private.school_today() uses app_config.timezone (Asia/Tashkent, UTC+5, no DST):
-- local 00:05 = 19:05 UTC. pg_cron runs without a JWT, which generate_daily_sets
-- allows. Re-scheduling the same job name replaces it, so this is safe to re-run.
-- If app_config.timezone ever changes, re-schedule this job to match.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
select cron.schedule('zamin-generate-daily-sets', '5 19 * * *', $$select public.generate_daily_sets()$$);
