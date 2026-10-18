-- ═══════════════════════════════════════════════════════════════════════════
--  Zamin Students — super_admin
--
--  super_admin = admin + managing admins. Every admin check now accepts
--  super_admin; only a super_admin can create, reset, rename or delete a plain
--  admin, or grant/revoke an admin-tier role. Nobody can manage a super_admin
--  through the RPCs (seed/promote one from the SQL editor instead).
--
--  Forward-only; applies on top of 20261018000000_demo_sections.sql.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────── Role helpers ───────────────────────────

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.my_role() in ('admin', 'super_admin'), false)
$$;

create or replace function private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.my_role() in ('teacher', 'admin', 'super_admin'), false)
$$;

create function private.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.my_role() = 'super_admin', false)
$$;

create function private.require_super_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_super_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
end $$;

-- Leaderboard visibility listed the roles explicitly; super_admin sees what admin sees.
create or replace function private.can_see_student(p_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.my_role()::text in ('student', 'teacher', 'admin', 'super_admin'), false)
      or private.is_parent_of(p_student)
$$;

-- ─────────────────────── Profile guard ───────────────────────
-- As before, plus: only a super_admin may move anyone into or out of the
-- admin tier with a direct update. (No JWT = SQL editor / seeding: allowed.)

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

  if new.role is distinct from old.role
     and (new.role in ('admin', 'super_admin') or old.role in ('admin', 'super_admin'))
     and auth.uid() is not null and not v_trusted and not private.is_super_admin() then
    raise exception 'only a super admin can change admin roles' using errcode = '42501';
  end if;

  new.updated_at := now();
  return new;
end $$;

-- ───────────────────────────── Management RPCs ─────────────────────────────

-- Super admin: create a plain admin. Same shape as create_teacher.
create function public.create_admin(p_full_name text, p_password text)
returns table (user_id uuid, login text)
language plpgsql security definer set search_path = '' as $$
declare
  v_id   uuid := gen_random_uuid();
  v_name text := regexp_replace(trim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
begin
  perform private.require_super_admin();
  if v_name = '' then raise exception 'name_required' using errcode = '22023'; end if;
  return query select v_id, private.create_auth_user(v_id, null, p_password, 'admin', v_name, null);
end $$;

-- Staff set a new password directly (no codes). Signs the user out everywhere.
-- Teachers: students/parents of their classes. Admin: anyone below admin.
-- Super admin: also plain admins (never a super_admin, never self).
create or replace function public.reset_password(p_user uuid, p_new_password text) returns void
language plpgsql security definer set search_path = '' as $$
declare p public.profiles;
begin
  perform private.require_staff();
  select * into p from public.profiles where id = p_user for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p.role in ('admin', 'super_admin') then
    -- only super_admin may manage a plain admin; never a super_admin, never self, via this RPC
    if not private.is_super_admin() or p.role = 'super_admin' or p.id = auth.uid() then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
  else
    if not private.is_admin() then
      if p.role = 'student' and not private.can_manage_student(p.id)
         or p.role = 'parent' and not private.can_manage_parent(p.id)
         or p.role not in ('student', 'parent') then
        raise exception 'forbidden' using errcode = '42501';
      end if;
    end if;
  end if;
  perform private.check_password(p_new_password);
  perform private.set_auth_password(p.id, p_new_password);
end $$;

-- Rename and/or move; the login stays the same. Admin-tier rule as reset_password.
create or replace function public.update_member(p_user uuid, p_full_name text default null, p_class_id uuid default null)
returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  p      public.profiles;
  v_name text := nullif(regexp_replace(trim(coalesce(p_full_name, '')), '\s+', ' ', 'g'), '');
begin
  perform private.require_staff();
  select * into p from public.profiles where id = p_user for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p.role in ('admin', 'super_admin') then
    -- only super_admin may manage a plain admin; never a super_admin, never self, via this RPC
    if not private.is_super_admin() or p.role = 'super_admin' or p.id = auth.uid() then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
  else
    if not private.is_admin() then
      if p.role = 'student' and not private.can_manage_student(p.id)
         or p.role = 'parent' and not private.can_manage_parent(p.id)
         or p.role not in ('student', 'parent') then
        raise exception 'forbidden' using errcode = '42501';
      end if;
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

-- Admin: delete an account (auth user → profile → ledger cascade).
-- Super admin may also delete a plain admin; nobody deletes a super_admin or themselves.
create or replace function public.delete_member(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_role public.user_role;
begin
  perform private.require_admin();
  if p_user = auth.uid() then raise exception 'forbidden' using errcode = '42501'; end if;
  select role into v_role from public.profiles where id = p_user;
  if v_role in ('admin', 'super_admin') and (not private.is_super_admin() or v_role = 'super_admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from auth.users where id = p_user;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
end $$;

-- ───────────────────────────── Privileges ─────────────────────────────
-- New functions only (create or replace keeps existing grants).
revoke execute on function
  private.is_super_admin(), private.require_super_admin()
from public, anon, authenticated;

revoke execute on function public.create_admin(text, text) from public, anon;
grant execute on function public.create_admin(text, text) to authenticated;
