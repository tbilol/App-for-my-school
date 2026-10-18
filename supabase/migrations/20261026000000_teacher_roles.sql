-- ═══════════════════════════════════════════════════════════════════════════
--  Zamin Students — phase 3-i: curators vs subject teachers
--
--  One 'teacher' role, two kinds of assignment (a teacher may hold either/both):
--    curator_classes (teacher, class)            → CURATOR: full access to the
--        class's students in every subject; manages their accounts + parents.
--    teacher_subjects (teacher, class, subject)  → SUBJECT TEACHER: that subject
--        only (levels, writing review, that subject's sets/items/streak) plus
--        the students' basic profile.
--  Admin / super_admin stay a full superset everywhere.
--
--  Permission matrix (enforced below):
--    view everything about a student ........ curator, admin
--    view one subject's daily work + streak .. that subject's teacher
--    set_student_level / review_daily_item ... that subject's teacher, admin (NOT curators)
--    add_student / create_parent / link / unlink / update_member / reset_password
--                                     ........ curator of the class, admin
--    penalize_student ........................ curator, any subject teacher, admin
--    award_class_activity .................... curator, or the teacher of p_subject, admin
--    messaging ("the student's teachers") .... curators + subject teachers
--
--  Existing teacher_classes rows become curator assignments. teacher_classes
--  itself becomes a read-only compatibility VIEW (every class a teacher is
--  assigned to in either way), still insertable by seeds (→ curator). The
--  current UI keeps working until phase 3-ii adapts it.
--
--  Additive: depends on everything through 20261025000000_daily_set_coins.sql.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────── Assignments ───────────────────────────

create table public.curator_classes (
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  class_id   uuid not null references public.classes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (teacher_id, class_id)
);
create index curator_classes_class_idx on public.curator_classes (class_id);

create table public.teacher_subjects (
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  class_id   uuid not null references public.classes (id) on delete cascade,
  subject    public.subject not null,
  created_at timestamptz not null default now(),
  primary key (teacher_id, class_id, subject)
);
create index teacher_subjects_class_idx on public.teacher_subjects (class_id, subject);

-- today's class teachers become curators
insert into public.curator_classes (teacher_id, class_id, created_at)
select teacher_id, class_id, created_at from public.teacher_classes
on conflict do nothing;

drop table public.teacher_classes;

-- Compatibility: "classes this teacher is assigned to, either way". Reads go
-- through the base tables' RLS (security_invoker).
create view public.teacher_classes with (security_invoker = on) as
  select teacher_id, class_id, min(created_at) as created_at
    from (select teacher_id, class_id, created_at from public.curator_classes
          union all
          select teacher_id, class_id, created_at from public.teacher_subjects) a
   group by teacher_id, class_id;

-- Seeds / SQL-editor scripts that insert class teachers keep working (→ curator).
create function private.teacher_classes_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.curator_classes (teacher_id, class_id) values (new.teacher_id, new.class_id)
    on conflict do nothing;
    return new;
  end if;
  delete from public.curator_classes where teacher_id = old.teacher_id and class_id = old.class_id;
  delete from public.teacher_subjects where teacher_id = old.teacher_id and class_id = old.class_id;
  return old;
end $$;
create trigger teacher_classes_write instead of insert or delete on public.teacher_classes
  for each row execute function private.teacher_classes_write();

alter table public.curator_classes enable row level security;
alter table public.teacher_subjects enable row level security;
create policy "curator_classes: own or admin" on public.curator_classes for select to authenticated
  using (teacher_id = auth.uid() or private.is_admin());
create policy "teacher_subjects: own or admin" on public.teacher_subjects for select to authenticated
  using (teacher_id = auth.uid() or private.is_admin());
-- written only by the admin RPCs below (or seeds)
revoke insert, update, delete on public.curator_classes, public.teacher_subjects from anon, authenticated;
revoke all on public.curator_classes, public.teacher_subjects, public.teacher_classes from anon;
revoke insert, update, delete on public.teacher_classes from authenticated;

-- ─────────────────────────── Scope helpers ───────────────────────────

-- Caller curates the student's class (or is admin).
create function private.is_curator_of(p_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_admin()
      or (private.my_role() = 'teacher' and exists (
            select 1 from public.profiles s
              join public.curator_classes cc on cc.class_id = s.class_id
             where s.id = p_student and s.role = 'student' and cc.teacher_id = auth.uid()))
$$;

-- Does p_teacher teach p_subject to p_student's class? (Direct; admins don't count.)
create function private.teaches_subject(p_teacher uuid, p_student uuid, p_subject public.subject) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles s
      join public.teacher_subjects ts on ts.class_id = s.class_id
      join public.profiles t on t.id = ts.teacher_id and t.role = 'teacher'
     where s.id = p_student and s.role = 'student'
       and ts.teacher_id = p_teacher and ts.subject = p_subject)
$$;

-- Caller teaches p_subject to the student (or is admin).
create function private.can_teach_subject(p_student uuid, p_subject public.subject) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_admin()
      or (private.my_role() = 'teacher' and private.teaches_subject(auth.uid(), p_student, p_subject))
$$;

-- Caller teaches the student at least one subject (basic-profile visibility, discipline).
create function private.teaches_student(p_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.my_role() = 'teacher' and exists (
    select 1 from public.profiles s
      join public.teacher_subjects ts on ts.class_id = s.class_id
     where s.id = p_student and s.role = 'student' and ts.teacher_id = auth.uid())
$$;

-- Full access = curator (admin included). Every caller of can_manage_student /
-- require_manage_student / can_manage_parent / can_view_member inherits this.
create or replace function private.can_manage_student(p_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_curator_of(p_student)
$$;

-- Account management in a class (add_student, moving a student into a class).
create or replace function private.teaches_class(p_class uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_admin()
      or (private.my_role() = 'teacher'
          and exists (select 1 from public.curator_classes where teacher_id = auth.uid() and class_id = p_class))
$$;

-- "The student's teachers" for messaging: curators + subject teachers of the class.
create or replace function private.teacher_of_student(p_teacher uuid, p_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles s
      join public.profiles t on t.id = p_teacher and t.role = 'teacher'
     where s.id = p_student and s.role = 'student'
       and (exists (select 1 from public.curator_classes cc where cc.teacher_id = p_teacher and cc.class_id = s.class_id)
         or exists (select 1 from public.teacher_subjects ts where ts.teacher_id = p_teacher and ts.class_id = s.class_id)))
$$;

-- ─────────────────────────── Subject-scoped RPCs ───────────────────────────

-- Levels: the subject's teacher (or admin) — not curators, not other subjects.
create or replace function public.set_student_level(p_student uuid, p_subject public.subject, p_level uuid)
returns public.student_levels
language plpgsql security definer set search_path = '' as $$
declare r public.student_levels;
begin
  perform private.require_staff();
  if not exists (select 1 from public.profiles where id = p_student and role = 'student') then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_subject is null or not private.can_teach_subject(p_student, p_subject) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
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

-- Writing review: the item's subject teacher (or admin) — not curators.
create or replace function public.review_daily_item(
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
  if not private.can_teach_subject(st.user_id, st.subject) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
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

-- Discipline: the curator, ANY subject teacher of the student, or admin.
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
  if not (private.is_curator_of(p_student) or private.teaches_student(p_student)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_amt := least(p_amount, v_bal);
  if v_amt > 0 then
    perform private.grant_coins(p_student, v_amt, 'spend', 'adjustment', null, p_reason, auth.uid());
  end if;
  return v_amt;
end $$;

-- Lesson activity coins: the curator, or the teacher of p_subject (a subject
-- teacher can't award under another subject or with no subject).
create or replace function public.award_class_activity(p_student_ids uuid[], p_subject public.subject,
                                                       p_amount integer default null, p_reason text default null)
returns integer
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
    -- whole call fails if any student is outside the caller's scope
    if not (private.is_curator_of(v_sid) or (p_subject is not null and private.can_teach_subject(v_sid, p_subject))) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
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

-- ─────────────────────────── Messaging ───────────────────────────

-- The child's teachers for the guardian: curators + subject teachers (with subjects).
drop function public.list_child_teachers(uuid);
create function public.list_child_teachers(p_student uuid)
returns table (teacher_id uuid, full_name text, is_curator boolean, subjects public.subject[])
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_parent_of(p_student) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select t.id, t.full_name,
           exists (select 1 from public.curator_classes cc where cc.teacher_id = t.id and cc.class_id = s.class_id),
           coalesce((select array_agg(ts.subject order by ts.subject) from public.teacher_subjects ts
                      where ts.teacher_id = t.id and ts.class_id = s.class_id), '{}')
      from public.profiles s
      join public.profiles t on t.role = 'teacher'
     where s.id = p_student
       and (exists (select 1 from public.curator_classes cc where cc.teacher_id = t.id and cc.class_id = s.class_id)
         or exists (select 1 from public.teacher_subjects ts where ts.teacher_id = t.id and ts.class_id = s.class_id))
     order by 3 desc, t.full_name;
end $$;

-- ─────────────────────────── Admin: assignments ───────────────────────────

-- Kept for the current admin UI: now sets the teacher's CURATOR classes.
create or replace function public.set_teacher_classes(p_teacher uuid, p_class_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.set_curator_classes(p_teacher, p_class_ids);
end $$;

create function public.set_curator_classes(p_teacher uuid, p_class_ids uuid[]) returns void
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
  delete from public.curator_classes where teacher_id = p_teacher;
  insert into public.curator_classes (teacher_id, class_id)
  select p_teacher, x from (select distinct unnest(coalesce(p_class_ids, '{}')) x) s;
end $$;

-- Replace a teacher's subject assignments: p_assignments = [{"class_id": uuid, "subject": "math"}, …].
create function public.set_teacher_subjects(p_teacher uuid, p_assignments jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v_rows int;
begin
  perform private.require_admin();
  if not exists (select 1 from public.profiles where id = p_teacher and role = 'teacher') then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if jsonb_typeof(coalesce(p_assignments, '[]')) <> 'array' then
    raise exception 'invalid_body' using errcode = '22023';
  end if;
  -- every element must name an existing class and a valid subject
  select count(*) into v_rows from jsonb_array_elements(coalesce(p_assignments, '[]')) a
   where not exists (select 1 from public.classes c where c.id::text = a ->> 'class_id')
      or not coalesce(a ->> 'subject', '') = any (enum_range(null::public.subject)::text[]);
  if v_rows > 0 then raise exception 'not_found' using errcode = 'P0002'; end if;

  delete from public.teacher_subjects where teacher_id = p_teacher;
  insert into public.teacher_subjects (teacher_id, class_id, subject)
  select distinct p_teacher, (a ->> 'class_id')::uuid, (a ->> 'subject')::public.subject
    from jsonb_array_elements(coalesce(p_assignments, '[]')) a;
end $$;

-- ───────────────────────────── RLS ─────────────────────────────
-- Curators/admin keep seeing everything via can_view_member (→ is_curator_of).
-- Subject teachers additionally see their subject's rows and a basic profile.

drop policy "profiles: read scoped" on public.profiles;
create policy "profiles: read scoped" on public.profiles for select to authenticated
  using (private.can_view_member(id) or private.teaches_student(id));

drop policy "daily_sets: read scoped" on public.daily_sets;
create policy "daily_sets: read scoped" on public.daily_sets for select to authenticated
  using (private.can_view_member(user_id) or private.can_teach_subject(user_id, subject));

drop policy "daily_items: read scoped" on public.daily_items;
create policy "daily_items: read scoped" on public.daily_items for select to authenticated
  using (exists (select 1 from public.daily_sets s
                  where s.id = set_id
                    and (private.can_view_member(s.user_id) or private.can_teach_subject(s.user_id, s.subject))));

-- the overall row (subject null) is curator/parent/own only
drop policy "student_streaks: read scoped" on public.student_streaks;
create policy "student_streaks: read scoped" on public.student_streaks for select to authenticated
  using (private.can_view_member(user_id) or (subject is not null and private.can_teach_subject(user_id, subject)));

drop policy "student_levels: read own, managed or parent" on public.student_levels;
create policy "student_levels: read scoped" on public.student_levels for select to authenticated
  using (user_id = auth.uid() or private.can_manage_student(user_id) or private.is_parent_of(user_id)
         or private.can_teach_subject(user_id, subject));

-- ─────────────────────────── Privileges ───────────────────────────
revoke execute on function
  private.is_curator_of(uuid), private.teaches_subject(uuid, uuid, public.subject),
  private.can_teach_subject(uuid, public.subject), private.teaches_student(uuid),
  private.teacher_classes_write(),
  public.list_child_teachers(uuid), public.set_curator_classes(uuid, uuid[]),
  public.set_teacher_subjects(uuid, jsonb)
from public, anon;
-- helpers referenced by RLS policies must be callable by the querying role
grant execute on function
  private.is_curator_of(uuid), private.can_teach_subject(uuid, public.subject), private.teaches_student(uuid)
to authenticated;
revoke execute on function private.teaches_subject(uuid, uuid, public.subject), private.teacher_classes_write() from authenticated;
grant execute on function
  public.list_child_teachers(uuid), public.set_curator_classes(uuid, uuid[]), public.set_teacher_subjects(uuid, jsonb)
to authenticated;
