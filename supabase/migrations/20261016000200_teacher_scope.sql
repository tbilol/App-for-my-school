-- ═══════════════════════════════════════════════════════════════════════════
--  Zamin Students — teacher ↔ class scoping, school code + activation codes on
--
--  • Teachers manage the roster, parents and coins ONLY for classes they are
--    assigned to (teacher_classes). Admin manages everything.
--  • Teachers can only READ students of their classes (and those students'
--    parents). The leaderboard views stay school-wide.
--  • The pre-login roster requires the school code; first login requires the
--    teacher-issued activation code.
--
--  Additive: depends on 20261016000100_auth_onboarding.sql.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.teacher_classes (
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  class_id   uuid not null references public.classes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (teacher_id, class_id)
);
create index teacher_classes_class_idx on public.teacher_classes (class_id);

-- ─────────────────────────── Scope helpers ───────────────────────────

create function private.teaches_class(p_class uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_admin()
      or (private.my_role() = 'teacher'
          and exists (select 1 from public.teacher_classes where teacher_id = auth.uid() and class_id = p_class))
$$;

create function private.can_manage_student(p_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_admin()
      or (private.my_role() = 'teacher' and exists (
            select 1 from public.profiles s
              join public.teacher_classes tc on tc.class_id = s.class_id
             where s.id = p_student and s.role = 'student' and tc.teacher_id = auth.uid()))
$$;

-- A teacher manages a parent if they manage at least one of that parent's children.
create function private.can_manage_parent(p_parent uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_admin()
      or exists (select 1 from public.parent_links l
                  where l.parent_id = p_parent and private.can_manage_student(l.student_id))
$$;

-- Row visibility for member-owned data (profiles, ledger, submissions, …).
create function private.can_view_member(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_user = auth.uid()
      or private.is_admin()
      or private.can_manage_student(p_user)
      or private.can_manage_parent(p_user)
      or private.is_parent_of(p_user)
$$;

create function private.require_manage_student(p_student uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_manage_student(p_student) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end $$;

-- ─────────────────────────── Admin: assignments ───────────────────────────

-- Replace a teacher's class list in one call (the admin UI sends checkbox state).
create function public.set_teacher_classes(p_teacher uuid, p_class_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if not exists (select 1 from public.profiles where id = p_teacher and role = 'teacher') then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if (select count(*) from public.classes where id = any (coalesce(p_class_ids, '{}')))
     <> (select count(distinct x) from unnest(coalesce(p_class_ids, '{}')) x) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  delete from public.teacher_classes where teacher_id = p_teacher;
  insert into public.teacher_classes (teacher_id, class_id)
  select p_teacher, x from (select distinct unnest(coalesce(p_class_ids, '{}')) x) s;
end $$;

-- ─────────────────── Roster RPCs, now class-scoped ───────────────────

create or replace function public.add_student(p_class uuid, p_full_name text)
returns table (user_id uuid, activation_code text)
language plpgsql security definer set search_path = '' as $$
declare
  v_id   uuid := gen_random_uuid();
  v_name text := regexp_replace(trim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
begin
  perform private.require_staff();
  if not exists (select 1 from public.classes where id = p_class) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not private.teaches_class(p_class) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_name = '' then raise exception 'name_required' using errcode = '22023'; end if;
  if exists (select 1 from public.profiles
              where class_id = p_class and role = 'student' and lower(full_name) = lower(v_name)) then
    raise exception 'duplicate_name' using errcode = '23505';
  end if;

  perform private.create_auth_user(v_id, private.roster_email(v_id), null, 'student', v_name, p_class, null, true);
  return query select v_id, private.new_activation_code(v_id);
end $$;

create or replace function public.create_parent(p_login text, p_password text, p_full_name text, p_student_ids uuid[])
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id    uuid := gen_random_uuid();
  v_login text := private.normalize_login(p_login);
  v_sid   uuid;
begin
  perform private.require_staff();
  perform private.check_password(p_password);
  if coalesce(trim(p_full_name), '') = '' then raise exception 'name_required' using errcode = '22023'; end if;
  if coalesce(array_length(p_student_ids, 1), 0) = 0
     or (select count(*) from public.profiles where id = any (p_student_ids) and role = 'student')
        <> (select count(distinct x) from unnest(p_student_ids) x) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  foreach v_sid in array p_student_ids loop
    perform private.require_manage_student(v_sid);
  end loop;
  if exists (select 1 from public.profiles where login = v_login) then
    raise exception 'login_taken' using errcode = '23505';
  end if;

  perform private.create_auth_user(v_id, private.login_email(v_login), p_password, 'parent',
                                   trim(p_full_name), null, v_login, false);
  insert into public.parent_links (parent_id, student_id, created_by)
  select v_id, s, auth.uid() from (select distinct unnest(p_student_ids) s) x;
  return v_id;
end $$;

create or replace function public.link_parent(p_parent uuid, p_student uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_staff();
  if not exists (select 1 from public.profiles where id = p_parent and role = 'parent')
     or not exists (select 1 from public.profiles where id = p_student and role = 'student') then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform private.require_manage_student(p_student);
  insert into public.parent_links (parent_id, student_id, created_by)
  values (p_parent, p_student, auth.uid()) on conflict do nothing;
end $$;

create or replace function public.unlink_parent(p_parent uuid, p_student uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_staff();
  perform private.require_manage_student(p_student);
  delete from public.parent_links where parent_id = p_parent and student_id = p_student;
end $$;

create or replace function public.update_member(p_user uuid, p_full_name text default null, p_class_id uuid default null)
returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  p      public.profiles;
  v_name text := nullif(regexp_replace(trim(coalesce(p_full_name, '')), '\s+', ' ', 'g'), '');
begin
  perform private.require_staff();
  select * into p from public.profiles where id = p_user for update;
  if not found or p.role = 'admin' then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not private.is_admin() then
    if p.role = 'student' and not private.can_manage_student(p.id)
       or p.role = 'parent' and not private.can_manage_parent(p.id)
       or p.role not in ('student', 'parent') then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;
  if p_class_id is not null and p.role <> 'student' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  if p_class_id is not null and not exists (select 1 from public.classes where id = p_class_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_class_id is not null and not private.teaches_class(p_class_id) then
    raise exception 'forbidden' using errcode = '42501';   -- teachers move students only between their own classes
  end if;
  if p.role = 'student' and exists (
       select 1 from public.profiles
        where id <> p.id and role = 'student'
          and class_id = coalesce(p_class_id, p.class_id)
          and lower(full_name) = lower(coalesce(v_name, p.full_name))) then
    raise exception 'duplicate_name' using errcode = '23505';
  end if;

  perform private.trusted_write(true);
  update public.profiles
     set full_name = coalesce(v_name, full_name),
         class_id  = coalesce(p_class_id, class_id)
   where id = p.id returning * into p;
  perform private.trusted_write(false);
  return p;
end $$;

create or replace function public.reset_password(p_user uuid, p_new_password text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare p public.profiles;
begin
  perform private.require_staff();
  select * into p from public.profiles where id = p_user for update;
  if not found or p.role = 'admin' then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not private.is_admin() then
    if p.role = 'student' and not private.can_manage_student(p.id)
       or p.role = 'parent' and not private.can_manage_parent(p.id)
       or p.role not in ('student', 'parent') then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;

  if p.role = 'parent' then
    perform private.check_password(p_new_password);
    perform private.set_auth_password(p.id, p_new_password);
    return null;
  end if;

  perform private.set_auth_password(p.id, encode(extensions.gen_random_bytes(24), 'hex'));
  update public.profiles set first_login = true where id = p.id;
  return private.new_activation_code(p.id);
end $$;

-- ─────────────────── Coin RPCs, now class-scoped ───────────────────
-- Bodies are unchanged from the init migration except for the scope checks.

create or replace function public.award_class_activity(
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
    perform private.require_manage_student(v_sid);   -- whole call fails if any student is outside the teacher's classes
    perform 1 from public.profiles where id = v_sid for update;
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

create or replace function public.penalize_student(p_student uuid, p_amount integer, p_reason text)
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
  perform private.require_manage_student(p_student);
  v_amt := least(p_amount, v_bal);
  if v_amt > 0 then
    perform private.grant_coins(p_student, v_amt, 'spend', 'adjustment', null, p_reason, auth.uid());
  end if;
  return v_amt;
end $$;

create or replace function public.record_event_result(
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
  select * into e from public.events where id = p_event for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.profiles where id = p_user and role = 'student') then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform private.require_manage_student(p_user);

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
  returning * into r;

  if v_coins > 0 then
    perform private.grant_coins(p_user, v_coins, 'earn', 'event', e.subject,
                                e.title || coalesce(' — ' || p_place || '-o''rin', ''), auth.uid(),
                                'event_results', r.id);
  end if;
  return r;
end $$;

create or replace function public.review_submission(
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
  perform private.require_manage_student(s.user_id);
  if s.status <> 'submitted' then raise exception 'already_reviewed' using errcode = 'P0001'; end if;
  select * into c from public.challenges where id = s.challenge_id;

  v_coins := case when p_approve then coalesce(p_coins, c.coins_reward) else 0 end;
  if v_coins < 0 or v_coins > c.coins_reward * 2 then
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

-- ───────────────────────────── RLS ─────────────────────────────
-- Teachers now read only their classes' students (and those students' parents).

drop policy "profiles: read self, staff, parent" on public.profiles;
create policy "profiles: read scoped" on public.profiles for select to authenticated
  using (private.can_view_member(id));

drop policy "coin_tx: read own, staff, parent" on public.coin_transactions;
create policy "coin_tx: read scoped" on public.coin_transactions for select to authenticated
  using (private.can_view_member(user_id));

drop policy "achievements: read own, staff, parent" on public.achievements;
create policy "achievements: read scoped" on public.achievements for select to authenticated
  using (private.can_view_member(user_id));

drop policy "event_results: read own, staff, parent" on public.event_results;
create policy "event_results: read scoped" on public.event_results for select to authenticated
  using (private.can_view_member(user_id));

drop policy "submissions: read own, staff, parent" on public.challenge_submissions;
create policy "submissions: read scoped" on public.challenge_submissions for select to authenticated
  using (private.can_view_member(user_id));

drop policy "parent_links: own or staff" on public.parent_links;
create policy "parent_links: read scoped" on public.parent_links for select to authenticated
  using (parent_id = auth.uid() or private.can_manage_student(student_id));

-- CASE guarantees the uuid cast only runs on uuid-shaped folder names.
drop policy "proofs: read own, staff, parent" on storage.objects;
create policy "proofs: read scoped" on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and case
           when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then private.can_view_member(((storage.foldername(name))[1])::uuid)
           else false
         end);

alter table public.teacher_classes enable row level security;
create policy "teacher_classes: own or admin" on public.teacher_classes for select to authenticated
  using (teacher_id = auth.uid() or private.is_admin());
revoke insert, update, delete on public.teacher_classes from anon, authenticated;   -- via set_teacher_classes()

-- The auth settings hold the school code: only admins may read them. (Anyone who
-- learned the code could browse the roster, so don't hand it to parents.)
drop policy "config: read" on public.app_config;
create policy "config: read" on public.app_config for select to authenticated
  using (key <> 'auth' or private.is_admin());

-- ─────────────────────────── Settings ───────────────────────────
-- Gate ON with a random placeholder code until admin_setup.sql (or the admin
-- panel) sets the real one — the roster is never publicly browsable by default.
update public.app_config
   set value = value || jsonb_build_object(
         'require_activation_code', true,
         'school_code', coalesce(nullif(value ->> 'school_code', ''),
                                 upper(encode(extensions.gen_random_bytes(5), 'hex')))),
       updated_at = now()
 where key = 'auth';

-- ───────────────────────────── Privileges ─────────────────────────────
revoke execute on all functions in schema public from public, anon;
revoke execute on all functions in schema private from public, anon, authenticated;

grant execute on function
  public.login_classes(text),
  public.login_students(uuid, text),
  public.login_teachers(text),
  public.set_initial_password(uuid, text, text, text)
to anon, authenticated;

grant execute on function public.set_teacher_classes(uuid, uuid[]) to authenticated;

grant execute on function
  private.is_admin(), private.is_staff(), private.my_role(),
  private.is_parent_of(uuid), private.can_see_student(uuid),
  private.teaches_class(uuid), private.can_manage_student(uuid),
  private.can_manage_parent(uuid), private.can_view_member(uuid)
to authenticated;
