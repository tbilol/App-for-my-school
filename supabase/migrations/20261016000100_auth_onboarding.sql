-- ═══════════════════════════════════════════════════════════════════════════
--  Zamin Students — role-based onboarding (students, teachers, parents)
--
--  Nobody has a real email. Supabase Auth gets synthetic addresses:
--    roster accounts (students, teachers): u.<profile id>@zamin.local
--      → user picks class + name (or teacher name) and types a password
--    login accounts (parents, admin):      <login>@login.zamin.local
--      → user types login + password
--  The client derives the address; the password check happens in Supabase Auth.
--
--  Accounts are created ONLY by these RPCs. Self sign-up through the Auth API
--  is rejected by the on_auth_user_created trigger.
--
--  Additive: depends on 20261015000000_init.sql and 20261016000000_parent_role.sql.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────── Schema ─────────────────────────────

alter table public.profiles
  add column first_login boolean not null default false,  -- true until a pre-created account sets its password
  add column login text unique
    check (login ~ '^[a-z0-9][a-z0-9._-]{2,31}$');          -- parents/admin only; lowercase

create table public.parent_links (
  parent_id  uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (parent_id, student_id)
);
create index parent_links_student_idx on public.parent_links (student_id);

-- One-time activation codes, handed to students/teachers by staff. Hashed and
-- kept in `private`, so no API role can read them.
create table private.activation_codes (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  code_hash  text not null,
  attempts   smallint not null default 0,
  created_at timestamptz not null default now()
);

-- Single-row "something changed" signal for live leaderboards. Students can no
-- longer read other profiles, so Realtime on `profiles` only sees their own row.
create table public.leaderboard_ticks (
  id        smallint primary key default 1 check (id = 1),
  bumped_at timestamptz not null default now()
);
insert into public.leaderboard_ticks default values;

insert into public.app_config (key, value, description) values
  ('auth', '{"min_password_length": 6, "require_activation_code": false, "max_code_attempts": 5, "school_code": null}',
   'Kirish sozlamalari: parol uzunligi, faollashtirish kodi, maktab kodi')
on conflict (key) do nothing;

-- ─────────────────────────── Private helpers ───────────────────────────

create function private.roster_email(p_id uuid) returns text
language sql immutable set search_path = '' as $$
  select 'u.' || p_id::text || '@zamin.local'
$$;

create function private.normalize_login(p_login text) returns text
language plpgsql immutable set search_path = '' as $$
declare v text := lower(trim(coalesce(p_login, '')));
begin
  if v !~ '^[a-z0-9][a-z0-9._-]{2,31}$' then
    raise exception 'invalid_login' using errcode = '22023';
  end if;
  return v;
end $$;

create function private.login_email(p_login text) returns text
language sql immutable set search_path = '' as $$
  select private.normalize_login(p_login) || '@login.zamin.local'
$$;

create function private.auth_cfg(p_field text) returns text
language sql stable security definer set search_path = '' as $$
  select private.cfg('auth') ->> p_field
$$;

create function private.check_password(p_password text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if length(coalesce(p_password, '')) < coalesce(private.auth_cfg('min_password_length')::int, 6) then
    raise exception 'weak_password' using errcode = '22023';
  end if;
end $$;

-- Optional gate on the public login RPCs (app_config.auth.school_code; null = off).
create function private.check_school_code(p_code text) returns void
language plpgsql stable security definer set search_path = '' as $$
declare v text := private.auth_cfg('school_code');
begin
  if v is not null and v <> '' and coalesce(trim(p_code), '') <> v then
    raise exception 'invalid_school_code' using errcode = '42501';
  end if;
end $$;

create function private.is_parent_of(p_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.parent_links where parent_id = auth.uid() and student_id = p_student)
$$;

-- May the caller see this student in leaderboards? Students/staff: yes.
-- Parents: only their own children (parents can't browse other students).
create function private.can_see_student(p_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.my_role()::text in ('student', 'teacher', 'admin'), false)
      or private.is_parent_of(p_student)
$$;

-- Creates an auth user + profile in one step. The profile fields travel in a
-- transaction-local setting that only server-side code can set; the trigger
-- reads it and refuses any sign-up that doesn't carry it.
create function private.create_auth_user(
  p_id uuid, p_email text, p_password text, p_role public.user_role, p_full_name text,
  p_class_id uuid, p_login text, p_first_login boolean
) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from auth.users where email = lower(p_email)) then
    raise exception 'login_taken' using errcode = '23505';
  end if;

  perform set_config('zamin.new_profile', jsonb_build_object(
    'role', p_role, 'full_name', p_full_name, 'class_id', p_class_id,
    'login', p_login, 'first_login', p_first_login)::text, true);

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', lower(p_email),
    -- pre-created accounts get an unguessable password until first login
    extensions.crypt(coalesce(p_password, encode(extensions.gen_random_bytes(24), 'hex')), extensions.gen_salt('bf', 10)),
    now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  );

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), p_id, p_id::text,
          jsonb_build_object('sub', p_id::text, 'email', lower(p_email), 'email_verified', true),
          'email', null, now(), now());

  perform set_config('zamin.new_profile', '', true);
  return p_id;
end $$;

create function private.set_auth_password(p_user uuid, p_password text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update auth.users
     set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf', 10)), updated_at = now()
   where id = p_user;
  delete from auth.sessions where user_id = p_user;   -- sign out other devices (refresh tokens cascade)
end $$;

-- Issues a fresh 6-digit code, stores its hash, returns the plain code once.
create function private.new_activation_code(p_user uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  b    bytea := extensions.gen_random_bytes(3);
  code text  := lpad((((get_byte(b, 0) << 16) | (get_byte(b, 1) << 8) | get_byte(b, 2)) % 1000000)::text, 6, '0');
begin
  insert into private.activation_codes (user_id, code_hash)
  values (p_user, extensions.crypt(code, extensions.gen_salt('bf', 8)))
  on conflict (user_id) do update set code_hash = excluded.code_hash, attempts = 0, created_at = now();
  return code;
end $$;

-- Lets vetted RPCs change role/class/name past guard_profile_update.
create function private.trusted_write(p_on boolean) returns void
language sql set search_path = '' as $$
  select set_config('zamin.trusted_write', case when p_on then 'on' else 'off' end, true)
$$;

-- ─────────────────────── Replaced trigger functions ───────────────────────

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v jsonb := nullif(current_setting('zamin.new_profile', true), '')::jsonb;
begin
  if v is null then
    raise exception 'self_signup_disabled' using errcode = '42501',
      hint = 'Accounts are created by teachers/admins via add_student, create_teacher, create_parent.';
  end if;
  insert into public.profiles (id, full_name, role, class_id, login, first_login)
  values (new.id, coalesce(v ->> 'full_name', ''), (v ->> 'role')::public.user_role,
          (v ->> 'class_id')::uuid, v ->> 'login', coalesce((v ->> 'first_login')::boolean, false));
  return new;
end $$;

create or replace function private.guard_profile_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_trusted boolean := coalesce(current_setting('zamin.trusted_write', true), 'off') = 'on';
begin
  if new.coin_balance is distinct from old.coin_balance
     and coalesce(current_setting('zamin.ledger_write', true), 'off') <> 'on' then
    raise exception 'coin_balance is managed by the ledger' using errcode = '42501';
  end if;

  if (new.role is distinct from old.role or new.class_id is distinct from old.class_id)
     and auth.uid() is not null and not v_trusted and not private.is_admin() then
    raise exception 'only admins can change role or class' using errcode = '42501';
  end if;

  new.updated_at := now();
  return new;
end $$;

-- Statement-level: one bump per insert batch.
create function private.bump_leaderboard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.leaderboard_ticks set bumped_at = now() where id = 1;
  return null;
end $$;

create trigger coin_transactions_bump_leaderboard
  after insert on public.coin_transactions
  for each statement execute function private.bump_leaderboard();

-- ───────────────────── Public (pre-login) RPCs — anon ─────────────────────
-- These deliberately expose only what the pickers need: class names, and
-- names + first_login of roster accounts. No balances, no logins, no parents.

create function public.login_classes(p_school_code text default null)
returns table (id uuid, name text, grade smallint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.check_school_code(p_school_code);
  return query
    select c.id, c.name, c.grade
      from public.classes c
     where exists (select 1 from public.profiles p where p.class_id = c.id and p.role = 'student')
     order by c.grade, c.name;
end $$;

create function public.login_students(p_class uuid, p_school_code text default null)
returns table (id uuid, full_name text, first_login boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.check_school_code(p_school_code);
  return query
    select p.id, p.full_name, p.first_login
      from public.profiles p
      join auth.users u on u.id = p.id and u.email = private.roster_email(p.id)
     where p.class_id = p_class and p.role = 'student'
     order by p.full_name;
end $$;

create function public.login_teachers(p_school_code text default null)
returns table (id uuid, full_name text, first_login boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.check_school_code(p_school_code);
  return query
    select p.id, p.full_name, p.first_login
      from public.profiles p
      join auth.users u on u.id = p.id and u.email = private.roster_email(p.id)
     where p.role = 'teacher'
     order by p.full_name;
end $$;

-- First login for a pre-created student/teacher. Returns a status instead of
-- raising on a wrong code, so the attempt counter survives (a raise would roll
-- it back). 'ok' | 'invalid_code' | 'code_locked'
create function public.set_initial_password(
  p_user uuid, p_password text, p_activation_code text default null, p_school_code text default null
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  p  public.profiles;
  ac private.activation_codes;
begin
  perform private.check_school_code(p_school_code);
  perform private.check_password(p_password);

  select * into p from public.profiles where id = p_user for update;
  if not found or p.role not in ('student', 'teacher') then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not p.first_login then
    raise exception 'password_already_set' using errcode = 'P0001';
  end if;

  if coalesce(private.auth_cfg('require_activation_code')::boolean, false) then
    select * into ac from private.activation_codes where user_id = p_user for update;
    if not found then return 'code_locked'; end if;   -- no code issued: staff must reset
    if ac.attempts >= coalesce(private.auth_cfg('max_code_attempts')::int, 5) then return 'code_locked'; end if;
    if p_activation_code is null or extensions.crypt(trim(p_activation_code), ac.code_hash) <> ac.code_hash then
      update private.activation_codes set attempts = attempts + 1 where user_id = p_user;
      return 'invalid_code';
    end if;
  end if;

  perform private.set_auth_password(p_user, p_password);
  update public.profiles set first_login = false where id = p_user;
  delete from private.activation_codes where user_id = p_user;
  return 'ok';
end $$;

-- ───────────────────────── Management RPCs ─────────────────────────

create function public.create_class(p_name text, p_grade smallint) returns public.classes
language plpgsql security definer set search_path = '' as $$
declare c public.classes;
begin
  perform private.require_admin();
  if coalesce(trim(p_name), '') = '' then raise exception 'name_required' using errcode = '22023'; end if;
  insert into public.classes (name, grade) values (trim(p_name), p_grade) returning * into c;
  return c;
exception when unique_violation then
  raise exception 'duplicate_name' using errcode = '23505';
end $$;

-- Teacher/admin: add a student to a class's roster. Returns the activation code
-- to hand to the student (shown once).
create function public.add_student(p_class uuid, p_full_name text)
returns table (user_id uuid, activation_code text)
language plpgsql security definer set search_path = '' as $$
declare
  v_id   uuid := gen_random_uuid();
  v_name text := regexp_replace(trim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
begin
  perform private.require_staff();
  if v_name = '' then raise exception 'name_required' using errcode = '22023'; end if;
  if not exists (select 1 from public.classes where id = p_class) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.profiles
              where class_id = p_class and role = 'student' and lower(full_name) = lower(v_name)) then
    raise exception 'duplicate_name' using errcode = '23505';   -- would be ambiguous in the picker
  end if;

  perform private.create_auth_user(v_id, private.roster_email(v_id), null, 'student', v_name, p_class, null, true);
  return query select v_id, private.new_activation_code(v_id);
end $$;

-- Admin: pre-create a teacher (name only). Returns the activation code.
create function public.create_teacher(p_full_name text)
returns table (user_id uuid, activation_code text)
language plpgsql security definer set search_path = '' as $$
declare
  v_id   uuid := gen_random_uuid();
  v_name text := regexp_replace(trim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
begin
  perform private.require_admin();
  if v_name = '' then raise exception 'name_required' using errcode = '22023'; end if;
  if exists (select 1 from public.profiles where role = 'teacher' and lower(full_name) = lower(v_name)) then
    raise exception 'duplicate_name' using errcode = '23505';
  end if;

  perform private.create_auth_user(v_id, private.roster_email(v_id), null, 'teacher', v_name, null, null, true);
  return query select v_id, private.new_activation_code(v_id);
end $$;

-- Teacher/admin: create a parent login and link it to one or more children.
create function public.create_parent(p_login text, p_password text, p_full_name text, p_student_ids uuid[])
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id    uuid := gen_random_uuid();
  v_login text := private.normalize_login(p_login);
begin
  perform private.require_staff();
  perform private.check_password(p_password);
  if coalesce(trim(p_full_name), '') = '' then raise exception 'name_required' using errcode = '22023'; end if;
  if coalesce(array_length(p_student_ids, 1), 0) = 0
     or (select count(*) from public.profiles where id = any (p_student_ids) and role = 'student')
        <> (select count(distinct x) from unnest(p_student_ids) x) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.profiles where login = v_login) then
    raise exception 'login_taken' using errcode = '23505';
  end if;

  perform private.create_auth_user(v_id, private.login_email(v_login), p_password, 'parent',
                                   trim(p_full_name), null, v_login, false);
  insert into public.parent_links (parent_id, student_id, created_by)
  select v_id, s, auth.uid() from (select distinct unnest(p_student_ids) s) x;
  return v_id;
end $$;

create function public.link_parent(p_parent uuid, p_student uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_staff();
  if not exists (select 1 from public.profiles where id = p_parent and role = 'parent')
     or not exists (select 1 from public.profiles where id = p_student and role = 'student') then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  insert into public.parent_links (parent_id, student_id, created_by)
  values (p_parent, p_student, auth.uid()) on conflict do nothing;
end $$;

create function public.unlink_parent(p_parent uuid, p_student uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_staff();
  delete from public.parent_links where parent_id = p_parent and student_id = p_student;
end $$;

-- Rename a member and/or move a student to another class.
-- Teachers: students and parents. Admin: anyone except admins.
create function public.update_member(p_user uuid, p_full_name text default null, p_class_id uuid default null)
returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  p      public.profiles;
  v_name text := nullif(regexp_replace(trim(coalesce(p_full_name, '')), '\s+', ' ', 'g'), '');
begin
  perform private.require_staff();
  select * into p from public.profiles where id = p_user for update;
  if not found or p.role = 'admin' then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not private.is_admin() and p.role not in ('student', 'parent') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_class_id is not null and p.role <> 'student' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  if p_class_id is not null and not exists (select 1 from public.classes where id = p_class_id) then
    raise exception 'not_found' using errcode = 'P0002';
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

-- Reset a forgotten/hijacked password and sign the user out everywhere.
--  • student/teacher → back to first-login; returns a new activation code
--  • parent          → p_new_password required; returns null
-- Teachers may reset students and parents; admin anyone except admins.
create function public.reset_password(p_user uuid, p_new_password text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare p public.profiles;
begin
  perform private.require_staff();
  select * into p from public.profiles where id = p_user for update;
  if not found or p.role = 'admin' then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not private.is_admin() and p.role not in ('student', 'parent') then
    raise exception 'forbidden' using errcode = '42501';
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

-- Admin: delete an account (auth user → profile → ledger cascade).
create function public.delete_member(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if p_user = auth.uid() or exists (select 1 from public.profiles where id = p_user and role = 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from auth.users where id = p_user;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
end $$;

-- ───────────────────────────── RLS ─────────────────────────────
-- Students: only their own rows. Parents: read-only on linked children.
-- Staff: as before. Leaderboard views (below) are the one window onto other
-- students, and they show names + points only.

drop policy "profiles: read" on public.profiles;
create policy "profiles: read self, staff, parent" on public.profiles for select to authenticated
  using (id = auth.uid() or private.is_staff() or private.is_parent_of(id));
-- Names are managed by staff (update_member) so nobody can rename themselves on the leaderboard.
revoke update (full_name) on public.profiles from authenticated;

drop policy "coin_tx: read own or staff" on public.coin_transactions;
create policy "coin_tx: read own, staff, parent" on public.coin_transactions for select to authenticated
  using (user_id = auth.uid() or private.is_staff() or private.is_parent_of(user_id));

drop policy "achievements: read" on public.achievements;
create policy "achievements: read own, staff, parent" on public.achievements for select to authenticated
  using (user_id = auth.uid() or private.is_staff() or private.is_parent_of(user_id));
drop policy "achievements: submit own" on public.achievements;
create policy "achievements: student submits own" on public.achievements for insert to authenticated
  with check (user_id = auth.uid() and private.my_role() = 'student' and status = 'pending'
              and coins_awarded = 0 and verified_by is null and verified_at is null);

drop policy "event_results: read" on public.event_results;
create policy "event_results: read own, staff, parent" on public.event_results for select to authenticated
  using (user_id = auth.uid() or private.is_staff() or private.is_parent_of(user_id));

drop policy "submissions: read own or staff" on public.challenge_submissions;
create policy "submissions: read own, staff, parent" on public.challenge_submissions for select to authenticated
  using (user_id = auth.uid() or private.is_staff() or private.is_parent_of(user_id));

drop policy "orders: read own or admin" on public.orders;
create policy "orders: read own, admin, parent" on public.orders for select to authenticated
  using (user_id = auth.uid() or private.is_admin() or private.is_parent_of(user_id));

drop policy "proofs: read own or staff" on storage.objects;
create policy "proofs: read own, staff, parent" on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and (
           (storage.foldername(name))[1] = auth.uid()::text
           or private.is_staff()
           or exists (select 1 from public.parent_links l
                       where l.parent_id = auth.uid() and l.student_id::text = (storage.foldername(name))[1])));

alter table public.parent_links enable row level security;
create policy "parent_links: own or staff" on public.parent_links for select to authenticated
  using (parent_id = auth.uid() or private.is_staff());
revoke insert, update, delete on public.parent_links from anon, authenticated;  -- via RPCs only

alter table public.leaderboard_ticks enable row level security;
create policy "leaderboard_ticks: read" on public.leaderboard_ticks for select to authenticated using (true);
revoke insert, update, delete on public.leaderboard_ticks from anon, authenticated;

-- ───────────────────────── Leaderboards (parent-safe) ─────────────────────────
-- The ranked views from the init migration are now internal. Clients read the
-- *_visible wrappers, which filter rows by private.can_see_student().
-- rating_points is an internal building block and is no longer exposed.

revoke select on public.rating_points from authenticated;

-- Ranks must be computed over ALL students before filtering, otherwise a parent
-- would see their child as "#1". Wrap the ranked sets and filter outside.
create view public.leaderboard_overall_visible with (security_invoker = off) as
  select * from public.leaderboard_overall where private.can_see_student(user_id);
create view public.leaderboard_subject_visible with (security_invoker = off) as
  select * from public.leaderboard_subject where private.can_see_student(user_id);

revoke select on public.leaderboard_overall, public.leaderboard_subject from authenticated;
grant select on public.leaderboard_overall_visible, public.leaderboard_subject_visible to authenticated;
revoke all on public.leaderboard_overall_visible, public.leaderboard_subject_visible from anon;
-- leaderboard_classes (class totals, no individuals) stays readable.

-- ───────────────────────────── Realtime ─────────────────────────────
alter publication supabase_realtime add table public.leaderboard_ticks;

-- ───────────────────────────── Privileges ─────────────────────────────
-- Supabase grants EXECUTE on new functions to anon/authenticated by default; reset that.
revoke execute on all functions in schema public from public, anon;
revoke execute on all functions in schema private from public, anon, authenticated;

grant execute on function
  public.login_classes(text),
  public.login_students(uuid, text),
  public.login_teachers(text),
  public.set_initial_password(uuid, text, text, text)
to anon, authenticated;

grant execute on function
  public.create_class(text, smallint),
  public.add_student(uuid, text),
  public.create_teacher(text),
  public.create_parent(text, text, text, uuid[]),
  public.link_parent(uuid, uuid),
  public.unlink_parent(uuid, uuid),
  public.update_member(uuid, text, uuid),
  public.reset_password(uuid, text),
  public.delete_member(uuid)
to authenticated;

-- helpers referenced by RLS policies / views run as the caller
grant execute on function
  private.is_admin(), private.is_staff(), private.my_role(),
  private.is_parent_of(uuid), private.can_see_student(uuid)
to authenticated;
