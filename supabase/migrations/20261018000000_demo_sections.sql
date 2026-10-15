-- ═══════════════════════════════════════════════════════════════════════════
--  Zamin Students — data for the demo sections (achievements, shop, feed)
--
--  • achievement_catalog: the list of achievements a student can earn. A
--    student's achievement row links to it via achievements.catalog_id; a
--    catalog entry without a verified row for that student shows as "locked".
--  • shop_items.emoji / achievement_catalog.emoji: lightweight artwork until
--    real product photos exist (image_url still wins when set).
--  • announcements: author_name is stamped server-side (students can't read
--    teacher profiles under RLS, so the feed can't join for it), and authors
--    can only edit/delete their own posts (admin: any).
--
--  Additive: depends on 20261017000000_simple_logins.sql. No changes to the
--  coin ledger or its balance check.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────── Achievement catalog ─────────────────────────────
create table public.achievement_catalog (
  id          uuid primary key default gen_random_uuid(),
  type        public.achievement_type not null,
  title       text not null,
  description text not null default '',
  emoji       text not null default '🏅',
  coins       integer not null check (coins >= 0),
  subject     public.subject,
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.achievements
  add column catalog_id uuid references public.achievement_catalog (id) on delete set null;
create index achievements_catalog_idx on public.achievements (catalog_id);

alter table public.achievement_catalog enable row level security;
create policy "achievement_catalog: read" on public.achievement_catalog for select to authenticated
  using (active or private.is_admin());
create policy "achievement_catalog: admin write" on public.achievement_catalog for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
revoke all on public.achievement_catalog from anon;

-- ───────────────────────────── Shop artwork ─────────────────────────────
alter table public.shop_items add column emoji text not null default '🎁';

-- ───────────────────────────── Announcements ─────────────────────────────
alter table public.announcements add column author_name text not null default '';

-- API callers always post as themselves; server-side scripts (no JWT) may set
-- created_by / author_name explicitly.
create function private.stamp_announcement() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
    new.author_name := '';
  end if;
  if coalesce(new.author_name, '') = '' then
    select full_name into new.author_name from public.profiles where id = new.created_by;
    new.author_name := coalesce(nullif(new.author_name, ''), 'Maktab ma''muriyati');
  end if;
  return new;
end $$;

create trigger announcements_stamp
  before insert on public.announcements
  for each row execute function private.stamp_announcement();

drop policy "announcements: staff write" on public.announcements;
create policy "announcements: staff post" on public.announcements for insert to authenticated
  with check (private.is_staff());
create policy "announcements: author or admin edit" on public.announcements for update to authenticated
  using (created_by = auth.uid() or private.is_admin())
  with check (created_by = auth.uid() or private.is_admin());
create policy "announcements: author or admin delete" on public.announcements for delete to authenticated
  using (created_by = auth.uid() or private.is_admin());
-- Author identity can't be rewritten after posting. (A column-level REVOKE is
-- a no-op while a table-level grant exists, so revoke the table grant and
-- re-grant only the editable columns.)
revoke update on public.announcements from authenticated;
grant update (title, body, pinned) on public.announcements to authenticated;

-- ───────────────────────────── Privileges ─────────────────────────────
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.is_admin(), private.is_staff(), private.my_role(),
  private.is_parent_of(uuid), private.can_see_student(uuid),
  private.teaches_class(uuid), private.can_manage_student(uuid),
  private.can_manage_parent(uuid), private.can_view_member(uuid)
to authenticated;
