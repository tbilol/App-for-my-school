-- Phase 2d-i: read-only parent portal.
--
-- Parents already read their linked children's profiles, coin ledger, daily
-- sets/items and streaks (private.can_view_member includes is_parent_of) and
-- their leaderboard rows (private.can_see_student). The one gap: a child's
-- subject levels, which tell "not placed yet" apart from "no set today".
-- Read-only — student_levels stays writable only through set_student_level().

drop policy "student_levels: read own or managed" on public.student_levels;
create policy "student_levels: read own, managed or parent" on public.student_levels for select to authenticated
  using (user_id = auth.uid() or private.can_manage_student(user_id) or private.is_parent_of(user_id));
