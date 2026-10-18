-- ═══════════════════════════════════════════════════════════════════════════
--  Zamin Students — one coin entry per daily set
--
--  Before: every correct auto-graded answer wrote its own coin_transactions row,
--  plus a separate completion-bonus row. Now answers are still graded one by
--  one (is_correct, and coins_awarded = what the answer is worth, for the
--  in-set tally), but nothing is credited until the set COMPLETES. Then ONE
--  subject-tagged row is written:
--      correct auto-graded items × daily.coins_per_correct
--    + daily.completion_bonus when completed on its own day
--  reason "<Fan> — kunlik vazifa (x/10)". Writing-review coins stay a separate
--  row on approval (review_daily_item, unchanged).
--
--  Sets already part-answered under the old rule were paid per answer; the
--  completion row subtracts what those answers already received, so nothing is
--  paid twice. The ledger stays append-only (grant_coins → balance trigger).
--
--  Additive: replaces private.submit_daily_item_core (moved there by
--  20261022000000_student_daily.sql) and the public jsonb wrapper.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function private.submit_daily_item_core(p_item uuid, p_answer jsonb) returns public.daily_items
language plpgsql security definer set search_path = '' as $$
declare
  v_uid     uuid := auth.uid();
  v_today   date := private.school_today();
  st        public.daily_sets;
  it        public.daily_items;
  v_key     jsonb;
  v_given   jsonb;
  v_ok      boolean;
  v_rate    int := greatest(coalesce(private.cfg_int('daily', '{coins_per_correct}'), 0), 0);
  v_correct int;
  v_total   int;
  v_paid    int;
  v_bonus   int := 0;
  v_amount  int;
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

    -- coins_awarded = this answer's worth; credited with the set below, not here
    update public.daily_items
       set student_answer = v_given, is_correct = v_ok, coins_awarded = case when v_ok then v_rate else 0 end,
           status = 'answered', answered_at = now()
     where id = it.id returning * into it;
  end if;

  if not exists (select 1 from public.daily_items where set_id = st.id and status = 'pending') then
    update public.daily_sets
       set status = 'completed', completed_at = now(), on_time = (set_date = v_today)
     where id = st.id returning * into st;

    select count(*) filter (where answer_mode <> 'text' and is_correct), count(*)
      into v_correct, v_total
      from public.daily_items where set_id = st.id;
    -- answers paid one by one before this migration (never the writing-review rows)
    select coalesce(sum(t.amount), 0) into v_paid
      from public.coin_transactions t
      join public.daily_items i on i.id = t.ref_id and i.set_id = st.id and i.answer_mode <> 'text'
     where t.ref_table = 'daily_items' and t.direction = 'earn';
    if st.on_time then
      v_bonus := greatest(coalesce(private.cfg_int('daily', '{completion_bonus}'), 0), 0);
    end if;
    v_amount := greatest(v_correct * v_rate - v_paid, 0) + v_bonus;
    if v_amount > 0 then
      perform private.grant_coins(v_uid, v_amount, 'earn', 'challenge', st.subject,
        format('%s — kunlik vazifa (%s/%s)',
               case st.subject when 'english' then 'Ingliz tili' when 'math' then 'Matematika' else 'IT' end,
               v_correct, v_total),
        null, 'daily_sets', st.id);
    end if;
    perform private.recompute_subject_streak(v_uid, st.subject);
    perform private.recompute_overall_streak(v_uid);
  end if;
  return it;
end $$;

-- The student-facing wrapper: as before, plus the set's breakdown.
--   set_coins    coins this set has credited so far (the completion row, any
--                pre-migration per-answer rows, approved writing)
--   set_correct  correct auto-graded answers so far
--   set_total    items in the set
--   set_bonus    completion bonus included (0 when late or not complete)
create or replace function public.submit_daily_item(p_item uuid, p_answer jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  it    public.daily_items;
  st    public.daily_sets;
  v_key jsonb;
  v_bonus int := 0;
begin
  it := private.submit_daily_item_core(p_item, p_answer);
  select * into st from public.daily_sets where id = it.set_id;
  if it.answer_mode <> 'text' then
    select answer into v_key from public.task_bank_keys where task_id = it.task_id;
  end if;
  if st.status = 'completed' and st.on_time then
    v_bonus := greatest(coalesce(private.cfg_int('daily', '{completion_bonus}'), 0), 0);
  end if;
  return to_jsonb(it) || jsonb_build_object(
    'correct_answer', v_key,
    'set_status',     st.status,
    'set_on_time',    st.on_time,
    'set_coins',      (select coalesce(sum(t.amount), 0) from public.coin_transactions t
                        where t.direction = 'earn'
                          and ((t.ref_table = 'daily_sets' and t.ref_id = st.id)
                            or (t.ref_table = 'daily_items' and t.ref_id in (select id from public.daily_items where set_id = st.id)))),
    'set_correct',    (select count(*) from public.daily_items where set_id = st.id and answer_mode <> 'text' and is_correct),
    'set_total',      (select count(*) from public.daily_items where set_id = st.id),
    'set_bonus',      v_bonus);
end $$;

revoke execute on function private.submit_daily_item_core(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.submit_daily_item(uuid, jsonb) from public, anon;
grant execute on function public.submit_daily_item(uuid, jsonb) to authenticated;
