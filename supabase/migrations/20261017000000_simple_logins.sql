-- ═══════════════════════════════════════════════════════════════════════════
--  Zamin Students — simple admin-issued logins (DEMO auth model)
--
--  Every account (student, teacher, parent, admin) signs in with LOGIN + PASSWORD
--  issued by the school. Supabase Auth sees  <login>@zamin.local .
--  Logins are generated from the person's name (Latin, lowercase, no spaces);
--  collisions get a numeric suffix: alivaliyev, alivaliyev2, alivaliyev3 …
--
--  Removes: school-code gate, public class/name lists, activation codes,
--  first-login flow, the u.<id>@zamin.local / <login>@login.zamin.local formats.
--  Keeps: no self sign-up, teacher↔class scoping, parent read-only access.
--
--  Forward-only; applies on top of 20261016000200_teacher_scope.sql and converts
--  any accounts that already exist (they get a generated login; their auth email
--  is rewritten). Pre-created accounts that never set a password need a new one
--  from the admin panel.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────── Remove the pre-login roster, school code, activation codes ─────────────

drop function if exists public.login_classes(text);
drop function if exists public.login_students(uuid, text);
drop function if exists public.login_teachers(text);
drop function if exists public.set_initial_password(uuid, text, text, text);
drop function if exists private.check_school_code(text);
drop function if exists private.new_activation_code(uuid);
drop table if exists private.activation_codes;

-- Signatures change (return types / arguments), so drop and recreate below.
drop function if exists public.add_student(uuid, text);
drop function if exists public.create_teacher(text);
drop function if exists public.create_parent(text, text, text, uuid[]);
drop function if exists public.reset_password(uuid, text);
drop function if exists private.create_auth_user(uuid, text, text, public.user_role, text, uuid, text, boolean);

update public.app_config
   set value = jsonb_build_object('min_password_length', coalesce((value ->> 'min_password_length')::int, 6)),
       description = 'Kirish sozlamalari: minimal parol uzunligi',
       updated_at = now()
 where key = 'auth';

-- ───────────────────────────── Login helpers ─────────────────────────────

create or replace function private.login_email(p_login text) returns text
language sql immutable set search_path = '' as $$
  select private.normalize_login(p_login) || '@zamin.local'
$$;

-- "Ulug'bek Sobirov" → "ulugbeksobirov", "Шохрух Каримов" → "shoxruxkarimov".
-- Uzbek/Russian Cyrillic is transliterated; apostrophes, spaces and anything
-- else outside [a-z0-9] are dropped. 24 chars max, leaving room for a suffix.
create function private.slugify_login(p_name text) returns text
language plpgsql immutable set search_path = '' as $$
declare v text := lower(coalesce(p_name, ''));
begin
  v := replace(v, 'ш', 'sh'); v := replace(v, 'щ', 'sh'); v := replace(v, 'ч', 'ch');
  v := replace(v, 'ю', 'yu'); v := replace(v, 'я', 'ya'); v := replace(v, 'ё', 'yo');
  v := replace(v, 'ж', 'j');  v := replace(v, 'ц', 'ts'); v := replace(v, 'ў', 'o');
  v := replace(v, 'ғ', 'g');  v := replace(v, 'қ', 'q');  v := replace(v, 'ҳ', 'h');
  v := translate(v, 'абвгдезийклмнопрстуфхыэ', 'abvgdeziyklmnoprstufxie');
  v := regexp_replace(v, '[^a-z0-9]', '', 'g');
  if v = '' then v := 'user'; end if;
  v := left(v, 24);
  if length(v) < 3 then v := rpad(v, 3, '0'); end if;   -- logins need ≥ 3 chars
  return v;
end $$;

-- Next free login for a name: base, base2, base3, … (case-insensitive by
-- construction: everything is lowercase). Serialized so two concurrent
-- creates can't pick the same login.
create function private.generate_login(p_name text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  base text := private.slugify_login(p_name);
  cand text := base;
  n    int  := 1;
begin
  perform pg_advisory_xact_lock(hashtext('zamin.generate_login'));
  while exists (select 1 from public.profiles where login = cand)
     or exists (select 1 from auth.users where email = cand || '@zamin.local') loop
    n := n + 1;
    cand := base || n;
  end loop;
  return cand;
end $$;

-- Creates auth user + profile. p_login null → generated from the name.
-- Returns the login.
create function private.create_auth_user(
  p_id uuid, p_login text, p_password text, p_role public.user_role, p_full_name text, p_class_id uuid
) returns text
language plpgsql security definer set search_path = '' as $$
declare v_login text := case when p_login is null then private.generate_login(p_full_name)
                             else private.normalize_login(p_login) end;
begin
  if p_login is not null and (
       exists (select 1 from public.profiles where login = v_login)
       or exists (select 1 from auth.users where email = private.login_email(v_login))) then
    raise exception 'login_taken' using errcode = '23505';
  end if;
  perform private.check_password(p_password);

  perform set_config('zamin.new_profile', jsonb_build_object(
    'role', p_role, 'full_name', p_full_name, 'class_id', p_class_id, 'login', v_login)::text, true);

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', private.login_email(v_login),
    extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
    now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  );

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), p_id, p_id::text,
          jsonb_build_object('sub', p_id::text, 'email', private.login_email(v_login), 'email_verified', true),
          'email', null, now(), now());

  perform set_config('zamin.new_profile', '', true);
  return v_login;
end $$;

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v jsonb := nullif(current_setting('zamin.new_profile', true), '')::jsonb;
begin
  if v is null then
    raise exception 'self_signup_disabled' using errcode = '42501',
      hint = 'Accounts are created by the school via add_student, create_teacher, create_parent.';
  end if;
  insert into public.profiles (id, full_name, role, class_id, login)
  values (new.id, coalesce(v ->> 'full_name', ''), (v ->> 'role')::public.user_role,
          (v ->> 'class_id')::uuid, v ->> 'login');
  return new;
end $$;

-- ─────────────────────── Convert existing accounts ───────────────────────
-- 1) everyone gets a login (roster accounts didn't have one), oldest first so
--    earlier accounts keep the unsuffixed name;
-- 2) every auth email becomes <login>@zamin.local.

do $$
declare r record;
begin
  for r in select id, full_name from public.profiles where login is null order by created_at, id loop
    update public.profiles set login = private.generate_login(r.full_name) where id = r.id;
  end loop;
end $$;

update auth.users u
   set email = p.login || '@zamin.local', updated_at = now()
  from public.profiles p
 where p.id = u.id and u.email is distinct from p.login || '@zamin.local';

update auth.identities i
   set identity_data = i.identity_data || jsonb_build_object('email', u.email), updated_at = now()
  from auth.users u
 where u.id = i.user_id and i.provider = 'email'
   and i.identity_data ->> 'email' is distinct from u.email;

alter table public.profiles alter column login set not null;
alter table public.profiles drop column first_login;
drop function if exists private.roster_email(uuid);

-- ─────────────────────── Ledger: allow account deletion ───────────────────────
-- Fix: the append-only trigger also fired on FK cascades, so deleting a student
-- with coin history (or a teacher who had awarded coins → awarded_by set null)
-- failed. Cascades run one trigger level deeper; direct edits stay blocked.
create or replace function private.ledger_immutable() returns trigger
language plpgsql as $$
begin
  if pg_trigger_depth() > 1 then   -- reached via ON DELETE CASCADE / SET NULL from an account deletion
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception 'coin_transactions is append-only; post an adjustment instead' using errcode = '42501';
end $$;

-- ───────────────────────────── Management RPCs ─────────────────────────────
-- Same names as before; now take a password and return the generated login.
-- Duplicate names are allowed (logins disambiguate them).

-- Live preview for the "add person" forms. The real login is fixed at creation
-- (it can differ if someone else took this one in between).
create function public.suggest_login(p_full_name text) returns text
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_staff();
  return private.generate_login(p_full_name);
end $$;

create function public.add_student(p_class uuid, p_full_name text, p_password text)
returns table (user_id uuid, login text)
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
  return query select v_id, private.create_auth_user(v_id, null, p_password, 'student', v_name, p_class);
end $$;

create function public.create_teacher(p_full_name text, p_password text)
returns table (user_id uuid, login text)
language plpgsql security definer set search_path = '' as $$
declare
  v_id   uuid := gen_random_uuid();
  v_name text := regexp_replace(trim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
begin
  perform private.require_admin();
  if v_name = '' then raise exception 'name_required' using errcode = '22023'; end if;
  return query select v_id, private.create_auth_user(v_id, null, p_password, 'teacher', v_name, null);
end $$;

create function public.create_parent(p_full_name text, p_password text, p_student_ids uuid[])
returns table (user_id uuid, login text)
language plpgsql security definer set search_path = '' as $$
declare
  v_id    uuid := gen_random_uuid();
  v_name  text := regexp_replace(trim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
  v_login text;
  v_sid   uuid;
begin
  perform private.require_staff();
  if v_name = '' then raise exception 'name_required' using errcode = '22023'; end if;
  if coalesce(array_length(p_student_ids, 1), 0) = 0
     or (select count(*) from public.profiles where id = any (p_student_ids) and role = 'student')
        <> (select count(distinct x) from unnest(p_student_ids) x) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  foreach v_sid in array p_student_ids loop
    perform private.require_manage_student(v_sid);
  end loop;

  v_login := private.create_auth_user(v_id, null, p_password, 'parent', v_name, null);
  insert into public.parent_links (parent_id, student_id, created_by)
  select v_id, s, auth.uid() from (select distinct unnest(p_student_ids) s) x;
  return query select v_id, v_login;
end $$;

-- Staff set a new password directly (no codes). Signs the user out everywhere.
-- Teachers: students/parents of their classes. Admin: anyone except admins.
create function public.reset_password(p_user uuid, p_new_password text) returns void
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
  perform private.check_password(p_new_password);
  perform private.set_auth_password(p.id, p_new_password);
end $$;

-- Rename and/or move; the login stays the same. No duplicate-name check now.
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
    raise exception 'forbidden' using errcode = '42501';
  end if;

  perform private.trusted_write(true);
  update public.profiles
     set full_name = coalesce(v_name, full_name),
         class_id  = coalesce(p_class_id, class_id)
   where id = p.id returning * into p;
  perform private.trusted_write(false);
  return p;
end $$;

-- ───────────────────────────── Privileges ─────────────────────────────
revoke execute on all functions in schema public from public, anon;
revoke execute on all functions in schema private from public, anon, authenticated;

grant execute on function
  public.suggest_login(text),
  public.add_student(uuid, text, text),
  public.create_teacher(text, text),
  public.create_parent(text, text, uuid[]),
  public.reset_password(uuid, text)
to authenticated;

grant execute on function
  private.is_admin(), private.is_staff(), private.my_role(),
  private.is_parent_of(uuid), private.can_see_student(uuid),
  private.teaches_class(uuid), private.can_manage_student(uuid),
  private.can_manage_parent(uuid), private.can_view_member(uuid)
to authenticated;
