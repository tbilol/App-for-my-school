-- ═══════════════════════════════════════════════════════════════════════════
--  Zamin Students — task-bank authoring RPCs (phase 2b)
--
--  Admin-only (require_admin → super_admin inherits) writes for levels and
--  task_bank + task_bank_keys, validated against the formats submit_daily_item
--  grades with:
--    choice → body {"options": [≥2 strings]}, key {"correct": <0-based index>} (or an array of indices)
--    exact  → key {"value": "…"} or {"values": ["…", …]}
--    text   → no key (teacher-reviewed); only for the writing skill
--  A task row and its key are always written together.
--
--  Forward-only; applies on top of 20261020000000_daily_tasks.sql.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────── Helpers ───────────────────────────

-- Skills each subject's bank may hold.
create function private.subject_skills(p_subject public.subject) returns public.task_skill[]
language sql immutable set search_path = '' as $$
  select case p_subject
    when 'english' then array['grammar', 'reading', 'writing']::public.task_skill[]
    when 'math'    then array['math']::public.task_skill[]
    when 'it'      then array['it']::public.task_skill[]
  end
$$;

create function private.clean_level_name(p_name text) returns text
language plpgsql immutable set search_path = '' as $$
declare v text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
begin
  if v = '' then raise exception 'name_required' using errcode = '22023'; end if;
  if length(v) > 40 then raise exception 'too_long' using errcode = '22023'; end if;
  return v;
end $$;

-- Validates one task and returns the normalized body + key:
--   {"body": {...}, "key": {...} | null}
-- Raises a stable error code on the first problem.
create function private.validate_task(
  p_subject public.subject, p_level uuid, p_skill public.task_skill, p_mode public.answer_mode,
  p_prompt text, p_body jsonb, p_answer jsonb, p_difficulty smallint
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_body    jsonb := coalesce(p_body, '{}'::jsonb);
  v_options jsonb;
  v_n       int;
  v_correct jsonb;
  v_values  jsonb;
  v_key     jsonb;
begin
  if p_subject is null or p_level is null
     or not exists (select 1 from public.levels where id = p_level and subject = p_subject) then
    raise exception 'invalid_level' using errcode = '22023';
  end if;
  if p_skill is null or not (p_skill = any (private.subject_skills(p_subject))) then
    raise exception 'invalid_skill' using errcode = '22023';
  end if;
  if p_mode is null or (p_skill = 'writing') <> (p_mode = 'text') then   -- writing ⇔ text
    raise exception 'invalid_answer_mode' using errcode = '22023';
  end if;
  if btrim(coalesce(p_prompt, '')) = '' then raise exception 'prompt_required' using errcode = '22023'; end if;
  if length(p_prompt) > 4000 then raise exception 'too_long' using errcode = '22023'; end if;
  if p_difficulty is null or p_difficulty not between 1 and 5 then
    raise exception 'invalid_difficulty' using errcode = '22023';
  end if;
  if jsonb_typeof(v_body) <> 'object' then raise exception 'invalid_body' using errcode = '22023'; end if;
  if length(v_body::text) > 20000 then raise exception 'too_long' using errcode = '22023'; end if;

  if p_mode = 'choice' then
    -- options: ≥2 non-empty strings, trimmed; indices are 0-based (as submit_daily_item compares them)
    if jsonb_typeof(v_body -> 'options') is distinct from 'array' then
      raise exception 'invalid_options' using errcode = '22023';
    end if;
    select jsonb_agg(to_jsonb(btrim(o #>> '{}')) order by i), count(*)
      into v_options, v_n
      from jsonb_array_elements(v_body -> 'options') with ordinality x(o, i);
    if v_n < 2 or exists (select 1 from jsonb_array_elements(v_body -> 'options') o
                           where jsonb_typeof(o) <> 'string' or btrim(o #>> '{}') = '') then
      raise exception 'invalid_options' using errcode = '22023';
    end if;
    v_body := jsonb_set(v_body, '{options}', v_options);

    v_correct := p_answer -> 'correct';
    if jsonb_typeof(v_correct) = 'number' then v_correct := jsonb_build_array(v_correct); end if;
    if jsonb_typeof(v_correct) is distinct from 'array' or jsonb_array_length(v_correct) = 0
       or exists (select 1 from jsonb_array_elements(v_correct) c
                   where jsonb_typeof(c) <> 'number' or (c #>> '{}')::numeric <> trunc((c #>> '{}')::numeric)
                      or (c #>> '{}')::numeric < 0 or (c #>> '{}')::numeric >= v_n) then
      raise exception 'invalid_correct' using errcode = '22023';
    end if;
    select jsonb_agg(distinct (c #>> '{}')::int) into v_correct from jsonb_array_elements(v_correct) c;
    v_key := jsonb_build_object('correct',
               case when jsonb_array_length(v_correct) = 1 then v_correct -> 0 else v_correct end);

  elsif p_mode = 'exact' then
    v_values := case
      when jsonb_typeof(p_answer -> 'values') = 'array' then p_answer -> 'values'
      when p_answer ? 'value' then jsonb_build_array(p_answer -> 'value')
    end;
    if v_values is null or exists (select 1 from jsonb_array_elements(v_values) a
                                    where jsonb_typeof(a) not in ('string', 'number')) then
      raise exception 'answer_required' using errcode = '22023';
    end if;
    -- trimmed, blanks dropped, duplicates (case/space-insensitive, as graded) removed, author's order kept
    select jsonb_agg(to_jsonb(d.v) order by d.i) into v_values
      from (select distinct on (lower(regexp_replace(btrim(a #>> '{}'), '\s+', ' ', 'g')))
                   btrim(a #>> '{}') as v, i
              from jsonb_array_elements(v_values) with ordinality x(a, i)
             where btrim(a #>> '{}') <> ''
             order by lower(regexp_replace(btrim(a #>> '{}'), '\s+', ' ', 'g')), i) d;
    if v_values is null then raise exception 'answer_required' using errcode = '22023'; end if;
    v_key := case when jsonb_array_length(v_values) = 1 then jsonb_build_object('value', v_values -> 0)
                  else jsonb_build_object('values', v_values) end;

  else  -- text: teacher-reviewed, no key
    v_key := null;
  end if;

  return jsonb_build_object('body', v_body, 'key', v_key);
end $$;

-- ───────────────────────────── Levels ─────────────────────────────

-- New level at the end of the subject's order.
create function public.create_level(p_subject public.subject, p_name text) returns public.levels
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := private.clean_level_name(p_name);
  r      public.levels;
begin
  perform private.require_admin();
  if p_subject is null then raise exception 'invalid_level' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('zamin.levels.' || p_subject::text));
  insert into public.levels (subject, ord, name)
  values (p_subject, coalesce((select max(ord) from public.levels where subject = p_subject), 0) + 1, v_name)
  returning * into r;
  return r;
exception when unique_violation then
  raise exception 'duplicate_name' using errcode = '23505';
end $$;

create function public.rename_level(p_level uuid, p_name text) returns public.levels
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := private.clean_level_name(p_name);
  r      public.levels;
begin
  perform private.require_admin();
  update public.levels set name = v_name where id = p_level returning * into r;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  return r;
exception when unique_violation then
  raise exception 'duplicate_name' using errcode = '23505';
end $$;

-- Inactive levels can't be newly assigned (set_student_level); students already
-- on one keep getting sets.
create function public.set_level_active(p_level uuid, p_active boolean) returns public.levels
language plpgsql security definer set search_path = '' as $$
declare r public.levels;
begin
  perform private.require_admin();
  update public.levels set active = coalesce(p_active, active) where id = p_level returning * into r;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  return r;
end $$;

-- Move a level to position p_new_ord (1-based, clamped) within its subject; the
-- others shift. Ords are rewritten 1..n, so gaps disappear.
create function public.reorder_level(p_level uuid, p_new_ord smallint) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_subject public.subject;
  v_ids     uuid[];
  v_pos     int;
begin
  perform private.require_admin();
  select subject into v_subject from public.levels where id = p_level;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(hashtext('zamin.levels.' || v_subject::text));

  v_ids := array(select id from public.levels where subject = v_subject and id <> p_level order by ord, created_at);
  v_pos := least(greatest(coalesce(p_new_ord, 1), 1), cardinality(v_ids) + 1);
  v_ids := v_ids[1:v_pos - 1] || p_level || v_ids[v_pos:];

  -- two passes: unique (subject, ord) is checked per row
  update public.levels l set ord = -x.pos from unnest(v_ids) with ordinality x(id, pos) where l.id = x.id;
  update public.levels l set ord =  x.pos from unnest(v_ids) with ordinality x(id, pos) where l.id = x.id;
end $$;

-- ───────────────────────────── Tasks ─────────────────────────────

-- New bank item (+ its key for choice/exact). Returns the task id.
create function public.create_task(
  p_subject public.subject, p_level uuid, p_skill public.task_skill, p_answer_mode public.answer_mode,
  p_prompt text, p_body jsonb, p_answer jsonb, p_difficulty smallint default 1
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v    jsonb;
  v_id uuid;
begin
  perform private.require_admin();
  v := private.validate_task(p_subject, p_level, p_skill, p_answer_mode, p_prompt, p_body, p_answer, coalesce(p_difficulty, 1::smallint));
  insert into public.task_bank (subject, level_id, skill, answer_mode, prompt, body, difficulty, created_by)
  values (p_subject, p_level, p_skill, p_answer_mode, btrim(p_prompt), v -> 'body', coalesce(p_difficulty, 1::smallint), auth.uid())
  returning id into v_id;
  if jsonb_typeof(v -> 'key') = 'object' then
    insert into public.task_bank_keys (task_id, answer) values (v_id, v -> 'key');
  end if;
  return v_id;
end $$;

-- Edit a bank item; null arguments keep the current value (p_answer null keeps
-- the current key, which must still fit the new mode/options). The subject is
-- fixed; the level may move within it. Already generated daily_items keep their
-- snapshot.
create function public.update_task(
  p_task uuid, p_level uuid default null, p_skill public.task_skill default null,
  p_answer_mode public.answer_mode default null, p_prompt text default null, p_body jsonb default null,
  p_answer jsonb default null, p_difficulty smallint default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  t public.task_bank;
  v jsonb;
begin
  perform private.require_admin();
  select * into t from public.task_bank where id = p_task for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;

  t.level_id    := coalesce(p_level, t.level_id);
  t.skill       := coalesce(p_skill, t.skill);
  t.answer_mode := coalesce(p_answer_mode, t.answer_mode);
  t.prompt      := coalesce(p_prompt, t.prompt);
  t.body        := coalesce(p_body, t.body);
  t.difficulty  := coalesce(p_difficulty, t.difficulty);
  v := private.validate_task(t.subject, t.level_id, t.skill, t.answer_mode, t.prompt, t.body,
         coalesce(p_answer, (select answer from public.task_bank_keys where task_id = t.id)), t.difficulty);

  update public.task_bank
     set level_id = t.level_id, skill = t.skill, answer_mode = t.answer_mode,
         prompt = btrim(t.prompt), body = v -> 'body', difficulty = t.difficulty
   where id = t.id;
  if jsonb_typeof(v -> 'key') = 'object' then
    insert into public.task_bank_keys (task_id, answer) values (t.id, v -> 'key')
    on conflict (task_id) do update set answer = excluded.answer;
  else
    delete from public.task_bank_keys where task_id = t.id;
  end if;
  return t.id;
end $$;

-- Deactivate instead of delete: served items are referenced by daily_items.
create function public.set_task_active(p_task uuid, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  update public.task_bank set active = coalesce(p_active, active) where id = p_task;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
end $$;

-- ───────────────────────────── Privileges ─────────────────────────────
revoke execute on function
  private.subject_skills(public.subject), private.clean_level_name(text),
  private.validate_task(public.subject, uuid, public.task_skill, public.answer_mode, text, jsonb, jsonb, smallint)
from public, anon, authenticated;

revoke execute on function
  public.create_level(public.subject, text), public.rename_level(uuid, text),
  public.set_level_active(uuid, boolean), public.reorder_level(uuid, smallint),
  public.create_task(public.subject, uuid, public.task_skill, public.answer_mode, text, jsonb, jsonb, smallint),
  public.update_task(uuid, uuid, public.task_skill, public.answer_mode, text, jsonb, jsonb, smallint),
  public.set_task_active(uuid, boolean)
from public, anon;
grant execute on function
  public.create_level(public.subject, text), public.rename_level(uuid, text),
  public.set_level_active(uuid, boolean), public.reorder_level(uuid, smallint),
  public.create_task(public.subject, uuid, public.task_skill, public.answer_mode, text, jsonb, jsonb, smallint),
  public.update_task(uuid, uuid, public.task_skill, public.answer_mode, text, jsonb, jsonb, smallint),
  public.set_task_active(uuid, boolean)
to authenticated;
