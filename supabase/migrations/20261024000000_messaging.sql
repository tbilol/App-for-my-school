-- ═══════════════════════════════════════════════════════════════════════════
--  Zamin Students — phase 2d-ii: parent ↔ teacher messaging + teacher reports
--
--  • ONE conversation per (teacher, student). Participants: that teacher + every
--    guardian of the student (parent_links). Students and admins are not
--    participants and read nothing here.
--  • Messages carry a kind: 'message' (anyone in the thread) or 'report'
--    (the conversation's teacher only; optional title).
--  • conversation_reads keeps each participant's last-read time → unread badges.
--  • All writes go through the RPCs below; tables are read-only to clients.
--
--  Additive: depends on 20261016000200_teacher_scope.sql (teacher_classes,
--  is_parent_of) and 20261016000100_auth_onboarding.sql (parent_links).
-- ═══════════════════════════════════════════════════════════════════════════

create type public.message_kind as enum ('message', 'report');

create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  teacher_id      uuid not null references public.profiles (id) on delete cascade,
  student_id      uuid not null references public.profiles (id) on delete cascade,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz,
  unique (teacher_id, student_id)
);
create index conversations_student_idx on public.conversations (student_id);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  kind            public.message_kind not null default 'message',
  title           text check (title is null or char_length(title) between 1 and 200),
  body            text not null check (char_length(body) between 1 and 4000),
  created_at      timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

create table public.conversation_reads (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  last_read_at    timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

-- ─────────────────────────── Helpers ───────────────────────────

-- Does p_teacher (a teacher) teach p_student's class? Direct check — admins don't count.
create function private.teacher_of_student(p_teacher uuid, p_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles s
      join public.teacher_classes tc on tc.class_id = s.class_id
      join public.profiles t on t.id = tc.teacher_id
     where s.id = p_student and s.role = 'student'
       and tc.teacher_id = p_teacher and t.role = 'teacher')
$$;

-- Is the caller a participant (the teacher, or a guardian of the student)?
create function private.in_conversation(p_conversation uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversations c
     where c.id = p_conversation
       and (c.teacher_id = auth.uid() or private.is_parent_of(c.student_id)))
$$;

-- ───────────────────────────── RLS ─────────────────────────────

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.conversation_reads enable row level security;

create policy "conversations: participants read" on public.conversations for select to authenticated
  using (teacher_id = auth.uid() or private.is_parent_of(student_id));
create policy "messages: participants read" on public.messages for select to authenticated
  using (private.in_conversation(conversation_id));
create policy "conversation_reads: own row read" on public.conversation_reads for select to authenticated
  using (user_id = auth.uid());
create policy "conversation_reads: own row write" on public.conversation_reads for insert to authenticated
  with check (user_id = auth.uid() and private.in_conversation(conversation_id));
create policy "conversation_reads: own row update" on public.conversation_reads for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and private.in_conversation(conversation_id));

revoke insert, update, delete on public.conversations, public.messages from anon, authenticated;
revoke delete on public.conversation_reads from anon, authenticated;
revoke all on public.conversations, public.messages, public.conversation_reads from anon;

-- ───────────────────────────── RPCs ─────────────────────────────

-- Get-or-create the (teacher, student) thread. Caller: a guardian of the
-- student, or that teacher. Either way the teacher must teach the student.
create function public.open_conversation(p_teacher uuid, p_student uuid) returns public.conversations
language plpgsql security definer set search_path = '' as $$
declare c public.conversations;
begin
  if auth.uid() is null or not (private.is_parent_of(p_student) or auth.uid() = p_teacher) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not private.teacher_of_student(p_teacher, p_student) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.conversations (teacher_id, student_id) values (p_teacher, p_student)
  on conflict (teacher_id, student_id) do nothing;
  select * into c from public.conversations where teacher_id = p_teacher and student_id = p_student;
  return c;
end $$;

-- Post to a thread. 'report' is the conversation teacher's only. The teacher
-- must still teach the student (a reassigned teacher's old threads go read-only).
create function public.send_message(p_conversation uuid, p_body text,
                                    p_kind public.message_kind default 'message', p_title text default null)
returns public.messages
language plpgsql security definer set search_path = '' as $$
declare
  c public.conversations;
  m public.messages;
  v_body  text := btrim(coalesce(p_body, ''));
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
begin
  select * into c from public.conversations where id = p_conversation;
  if not found or auth.uid() is null
     or not (c.teacher_id = auth.uid() or private.is_parent_of(c.student_id)) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not private.teacher_of_student(c.teacher_id, c.student_id) then
    raise exception 'conversation_closed' using errcode = 'P0001';
  end if;
  if coalesce(p_kind, 'message') = 'report' and auth.uid() <> c.teacher_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_body = '' then raise exception 'message_empty' using errcode = '22023'; end if;
  if char_length(v_body) > 4000 or char_length(coalesce(v_title, '')) > 200 then
    raise exception 'message_too_long' using errcode = '22023';
  end if;
  -- titles belong to reports
  if coalesce(p_kind, 'message') = 'message' then v_title := null; end if;

  insert into public.messages (conversation_id, sender_id, kind, title, body)
  values (c.id, auth.uid(), coalesce(p_kind, 'message'), v_title, v_body)
  returning * into m;
  update public.conversations set last_message_at = m.created_at where id = c.id;
  -- the sender has read their own message
  insert into public.conversation_reads (conversation_id, user_id, last_read_at) values (c.id, auth.uid(), m.created_at)
  on conflict (conversation_id, user_id) do update set last_read_at = greatest(public.conversation_reads.last_read_at, excluded.last_read_at);
  return m;
end $$;

create function public.mark_conversation_read(p_conversation uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.in_conversation(p_conversation) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  insert into public.conversation_reads (conversation_id, user_id, last_read_at) values (p_conversation, auth.uid(), now())
  on conflict (conversation_id, user_id) do update set last_read_at = now();
end $$;

-- Teachers of the guardian's child (whom the parent may message).
create function public.list_child_teachers(p_student uuid)
returns table (teacher_id uuid, full_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_parent_of(p_student) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select distinct t.id, t.full_name
      from public.profiles s
      join public.teacher_classes tc on tc.class_id = s.class_id
      join public.profiles t on t.id = tc.teacher_id and t.role = 'teacher'
     where s.id = p_student
     order by t.full_name;
end $$;

-- The caller's threads (teacher: own; parent: their children's, optionally one
-- child) with names, the last message, unread count and whether it still
-- accepts messages. Names come from here because parents can't read teacher
-- profiles (or a co-guardian's) under RLS.
create function public.list_my_conversations(p_student uuid default null)
returns table (
  id uuid, teacher_id uuid, teacher_name text, student_id uuid, student_name text, class_name text,
  guardians jsonb, created_at timestamptz, last_message_at timestamptz,
  last_kind public.message_kind, last_title text, last_body text, last_sender_id uuid,
  unread integer, open boolean
)
language sql stable security definer set search_path = '' as $$
  select c.id, c.teacher_id, t.full_name, c.student_id, s.full_name, cl.name,
         coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'full_name', g.full_name) order by g.full_name)
                     from public.parent_links pl join public.profiles g on g.id = pl.parent_id
                    where pl.student_id = c.student_id), '[]'::jsonb),
         c.created_at, c.last_message_at,
         lm.kind, lm.title, lm.body, lm.sender_id,
         (select count(*)::integer from public.messages m
           where m.conversation_id = c.id and m.sender_id <> auth.uid()
             and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)),
         private.teacher_of_student(c.teacher_id, c.student_id)
    from public.conversations c
    join public.profiles t on t.id = c.teacher_id
    join public.profiles s on s.id = c.student_id
    left join public.classes cl on cl.id = s.class_id
    left join public.conversation_reads r on r.conversation_id = c.id and r.user_id = auth.uid()
    left join lateral (
      select m.kind, m.title, m.body, m.sender_id from public.messages m
       where m.conversation_id = c.id order by m.created_at desc limit 1) lm on true
   where (c.teacher_id = auth.uid() or private.is_parent_of(c.student_id))
     and (p_student is null or c.student_id = p_student)
   order by coalesce(c.last_message_at, c.created_at) desc
$$;

-- ─────────────────────────── Privileges ───────────────────────────
revoke execute on function
  private.teacher_of_student(uuid, uuid), private.in_conversation(uuid),
  public.open_conversation(uuid, uuid), public.send_message(uuid, text, public.message_kind, text),
  public.mark_conversation_read(uuid), public.list_child_teachers(uuid), public.list_my_conversations(uuid)
from public, anon;
-- in_conversation is used by RLS policies, so the caller needs it.
grant execute on function private.in_conversation(uuid) to authenticated;
revoke execute on function private.teacher_of_student(uuid, uuid) from authenticated;
grant execute on function
  public.open_conversation(uuid, uuid), public.send_message(uuid, text, public.message_kind, text),
  public.mark_conversation_read(uuid), public.list_child_teachers(uuid), public.list_my_conversations(uuid)
to authenticated;
