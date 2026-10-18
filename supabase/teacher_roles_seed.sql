-- ═══════════════════════════════════════════════════════════════════════════
--  Zamin Students — DEMO seed for curators vs subject teachers (dev only, NOT auto-run)
--  Run in the dev SQL editor AFTER 20261026000000_teacher_roles.sql (and seed.sql).
--  Safe to re-run: accounts are created once (fixed ids), assignments upsert.
--
--  Aziz Yusupov's class (9-A):
--    curator           Jasur Toshmatov       (existing demo teacher)
--    english teacher   Dilnoza Karimova      login ingliz.ustoz      password Zamin2026!
--    math teacher      Bobur Aliyev          login matem.ustoz       password Zamin2026!
--    IT teacher        Sardor Rahimov        login it.ustoz          password Zamin2026!
--  The final SELECT prints the logins.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_class uuid := (select class_id from public.profiles where id = 'b0000000-0000-0000-0000-000000000001');  -- Aziz
  v_jasur uuid := 'a0000000-0000-0000-0000-000000000002';
  t record;
begin
  if v_class is null then raise exception 'Aziz Yusupov (seed.sql) not found — run seed.sql first'; end if;

  insert into public.curator_classes (teacher_id, class_id) values (v_jasur, v_class) on conflict do nothing;

  for t in select * from (values
      ('a0000000-0000-0000-0000-000000000021'::uuid, 'ingliz.ustoz', 'Dilnoza Karimova', 'english'::public.subject),
      ('a0000000-0000-0000-0000-000000000022'::uuid, 'matem.ustoz',  'Bobur Aliyev',     'math'::public.subject),
      ('a0000000-0000-0000-0000-000000000023'::uuid, 'it.ustoz',     'Sardor Rahimov',   'it'::public.subject)
    ) v (id, login, full_name, subject)
  loop
    if not exists (select 1 from public.profiles where id = t.id) then
      perform private.create_auth_user(t.id, t.login, 'Zamin2026!', 'teacher', t.full_name, null);
    end if;
    insert into public.teacher_subjects (teacher_id, class_id, subject) values (t.id, v_class, t.subject)
    on conflict do nothing;
  end loop;
end $$;

select p.full_name, p.login, 'Zamin2026!' as password,
       case when cc.teacher_id is not null then 'curator' else 'subject: ' || ts.subject::text end as role_in_class,
       c.name as class
  from public.profiles p
  join public.classes c on c.id = (select class_id from public.profiles where id = 'b0000000-0000-0000-0000-000000000001')
  left join public.curator_classes cc on cc.teacher_id = p.id and cc.class_id = c.id
  left join public.teacher_subjects ts on ts.teacher_id = p.id and ts.class_id = c.id
 where p.id in ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000021',
                'a0000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-000000000023')
 order by cc.teacher_id is null, ts.subject;
