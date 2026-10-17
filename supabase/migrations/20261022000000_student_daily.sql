-- ═══════════════════════════════════════════════════════════════════════════
--  Zamin Students — student daily-tasks screen support (phase 2c)
--
--  1. Per-student set generation moves into private.generate_student_sets;
--     generate_daily_sets (cron/admin, all students) now loops over it, and the
--     new ensure_my_today_sets() lets a student create their own sets for today
--     on page load instead of waiting for the midnight cron.
--  2. submit_daily_item now returns jsonb: the answered item plus, ONLY once the
--     answer is locked in, the correct answer (choice/exact; null for text), and
--     the set's state so the UI can celebrate. Grading, coins and streaks are
--     unchanged: the 2a function is kept as-is under private and wrapped.
--
--  Forward-only; applies on top of 20261021000000_task_bank_authoring.sql.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────── Generation ───────────────────────────

-- One student's sets for p_date: every subject with a level and a non-empty
-- weighted active pool that has no set yet. Same sampling as before. Returns
-- sets created. Callers check permissions, dates and skip days.
create function private.generate_student_sets(p_user uuid, p_date date) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_size    int  := coalesce(private.cfg_int('daily', '{set_size}'), 10);
  v_avoid   int  := coalesce(private.cfg_int('daily', '{avoid_recent_days}'), 14);
  v_weights jsonb;
  v_recent  uuid[];
  v_set     uuid;
  v_created int := 0;
  s         record;
begin
  for s in
    select sl.user_id, sl.subject, sl.level_id
      from public.student_levels sl
      join public.profiles p on p.id = sl.user_id and p.role = 'student'
     where sl.user_id = p_user
       and not exists (select 1 from public.daily_sets d
                        where d.user_id = sl.user_id and d.subject = sl.subject and d.set_date = p_date)
  loop
    -- skill weights for the subject; no config → every skill weight 1; weight ≤ 0 → never served
    v_weights := private.cfg('daily') -> 'weights' -> s.subject::text;
    continue when not exists (
      select 1 from public.task_bank t
       where t.subject = s.subject and t.level_id = s.level_id and t.active
         and coalesce((v_weights ->> t.skill::text)::numeric, case when v_weights is null then 1 else 0 end) > 0);

    insert into public.daily_sets (user_id, subject, set_date) values (s.user_id, s.subject, p_date)
    on conflict (user_id, subject, set_date) do nothing
    returning id into v_set;
    continue when v_set is null;

    v_recent := array(
      select di.task_id from public.daily_items di
        join public.daily_sets ds on ds.id = di.set_id
       where ds.user_id = s.user_id and ds.subject = s.subject
         and ds.set_date >= p_date - v_avoid and ds.set_date < p_date);

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

-- Cron (no JWT) or admin: create the day's sets for every student. Idempotent;
-- returns sets created. Never for a future date; nothing on skip days (but
-- streak rollover still runs). Behaviour unchanged from 2a.
create or replace function public.generate_daily_sets(p_date date default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_date    date := coalesce(p_date, private.school_today());
  v_created int  := 0;
  u         record;
begin
  if auth.uid() is not null and not private.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_date > private.school_today() then return 0; end if;
  perform private.reset_broken_streaks(v_date);
  if not private.is_school_day(v_date) then return 0; end if;

  for u in
    select distinct sl.user_id from public.student_levels sl
      join public.profiles p on p.id = sl.user_id and p.role = 'student'
  loop
    v_created := v_created + private.generate_student_sets(u.user_id, v_date);
  end loop;
  return v_created;
end $$;

-- Student: make sure today's sets exist (only today — never past or future).
-- Also zeroes the caller's own broken streaks, in case the midnight cron
-- hasn't run. Returns sets created; 0 for non-students and on skip days.
create function public.ensure_my_today_sets() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_today date := private.school_today();
begin
  if private.my_role() is distinct from 'student' then return 0; end if;
  update public.student_streaks
     set current_streak = 0, updated_at = now()
   where user_id = v_uid and current_streak > 0
     and (last_completed_on is null or last_completed_on < private.prev_school_day(v_today));
  if not private.is_school_day(v_today) then return 0; end if;
  return private.generate_student_sets(v_uid, v_today);
end $$;

-- ─────────────────────────── Submitting ───────────────────────────

-- Keep the 2a grader verbatim (role check, ownership, locking, grading, coins,
-- completion bonus, streak recompute) as a private core…
alter function public.submit_daily_item(uuid, jsonb) rename to submit_daily_item_core;
alter function public.submit_daily_item_core(uuid, jsonb) set schema private;
revoke execute on function private.submit_daily_item_core(uuid, jsonb) from public, anon, authenticated;

-- …and wrap it. The core raises unless the item was the caller's and still
-- pending, so the key below is only ever revealed for an answer just locked in.
--   returns: the daily_items row as json, plus
--     correct_answer  {"correct": n | [..]} / {"value": ".."} / {"values": [..]}; null for text
--     set_status      'pending' | 'completed'
--     set_on_time     true/false once completed (on time ⇒ bonus + streak), else null
--     set_coins       coins this set has paid so far (items + completion bonus)
create function public.submit_daily_item(p_item uuid, p_answer jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  it    public.daily_items;
  st    public.daily_sets;
  v_key jsonb;
begin
  it := private.submit_daily_item_core(p_item, p_answer);
  select * into st from public.daily_sets where id = it.set_id;
  if it.answer_mode <> 'text' then
    select answer into v_key from public.task_bank_keys where task_id = it.task_id;
  end if;
  return to_jsonb(it) || jsonb_build_object(
    'correct_answer', v_key,
    'set_status',     st.status,
    'set_on_time',    st.on_time,
    'set_coins',      (select coalesce(sum(coins_awarded), 0) from public.daily_items where set_id = st.id)
                    + (select coalesce(sum(amount), 0) from public.coin_transactions
                        where ref_table = 'daily_sets' and ref_id = st.id and direction = 'earn'));
end $$;

-- ───────────────────────────── Privileges ─────────────────────────────
revoke execute on function private.generate_student_sets(uuid, date) from public, anon, authenticated;

revoke execute on function public.ensure_my_today_sets(), public.submit_daily_item(uuid, jsonb) from public, anon;
grant execute on function public.ensure_my_today_sets(), public.submit_daily_item(uuid, jsonb) to authenticated;
