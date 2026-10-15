-- ═══════════════════════════════════════════════════════════════════════════
--  Zamin Students — DEMO seed
--  Run in the Supabase SQL editor AFTER `npx supabase db push`.
--  Safe to re-run: demo accounts are deleted and recreated, other demo rows are
--  upserted by fixed id. Ends by listing every demo login.
--
--  All demo accounts: password  Zamin2026!   (logins are generated from names;
--  the two "Ali Valiyev"s become alivaliyev and alivaliyev2)
--  No admin here — the admin is created by supabase/admin_setup.sql (gitignored).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Clean previous demo accounts (cascades their coins, orders, results, links) ───
delete from auth.users where id in (
  'a0000000-0000-0000-0000-000000000001',   -- dev admin from older seeds; never recreated here
  'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003',
  'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003',
  'b0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000006',
  'b0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000009',
  'b0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000012',
  'c1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002');

-- ─── Classes ───
insert into public.classes (id, name, grade) values
  ('c0000000-0000-0000-0000-000000000007', '7-A', 7),
  ('c0000000-0000-0000-0000-000000000008', '8-A', 8),
  ('c0000000-0000-0000-0000-000000000009', '9-A', 9),
  ('c0000000-0000-0000-0000-000000000010', '10-A', 10)
on conflict (id) do update set name = excluded.name, grade = excluded.grade;

-- ─── Accounts — created through the same helper the RPCs use ───
drop table if exists seed_users;
create temporary table seed_users (ord int, id uuid, full_name text, role public.user_role, class_id uuid);
insert into seed_users values
  ( 1, 'a0000000-0000-0000-0000-000000000002', 'Jasur Toshmatov',    'teacher', null),
  ( 2, 'a0000000-0000-0000-0000-000000000003', 'Malika Rahimova',    'teacher', null),
  ( 3, 'b0000000-0000-0000-0000-000000000001', 'Aziz Yusupov',       'student', 'c0000000-0000-0000-0000-000000000009'),
  ( 4, 'b0000000-0000-0000-0000-000000000002', 'Madina Aliyeva',     'student', 'c0000000-0000-0000-0000-000000000009'),
  ( 5, 'b0000000-0000-0000-0000-000000000003', 'Sardor Nematov',     'student', 'c0000000-0000-0000-0000-000000000009'),
  ( 6, 'b0000000-0000-0000-0000-000000000004', 'Kamola Xasanova',    'student', 'c0000000-0000-0000-0000-000000000010'),
  ( 7, 'b0000000-0000-0000-0000-000000000005', 'Bekzod Ergashev',    'student', 'c0000000-0000-0000-0000-000000000010'),
  ( 8, 'b0000000-0000-0000-0000-000000000006', 'Ali Valiyev',        'student', 'c0000000-0000-0000-0000-000000000010'),
  ( 9, 'b0000000-0000-0000-0000-000000000007', 'Otabek Mirzayev',    'student', 'c0000000-0000-0000-0000-000000000008'),
  (10, 'b0000000-0000-0000-0000-000000000008', 'Shahzoda Qodirova',  'student', 'c0000000-0000-0000-0000-000000000008'),
  (11, 'b0000000-0000-0000-0000-000000000009', 'Ali Valiyev',        'student', 'c0000000-0000-0000-0000-000000000008'),
  (12, 'b0000000-0000-0000-0000-000000000010', 'Sevara Abdullayeva', 'student', 'c0000000-0000-0000-0000-000000000007'),
  (13, 'b0000000-0000-0000-0000-000000000011', 'Ulug''bek Sobirov',  'student', 'c0000000-0000-0000-0000-000000000007'),
  (14, 'b0000000-0000-0000-0000-000000000012', 'Zarina Hamidova',    'student', 'c0000000-0000-0000-0000-000000000007'),
  (15, 'c1000000-0000-0000-0000-000000000001', 'Rustam Yusupov',     'parent',  null),
  (16, 'c1000000-0000-0000-0000-000000000002', 'Gulnora Xasanova',   'parent',  null);

-- one at a time, in order, so login suffixes are deterministic (alivaliyev → alivaliyev2)
do $$
declare u record;
begin
  for u in select * from seed_users order by ord loop
    perform private.create_auth_user(u.id, null, 'Zamin2026!', u.role, u.full_name, u.class_id);
  end loop;
end $$;

insert into public.teacher_classes (teacher_id, class_id) values
  ('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000009'),
  ('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000010'),
  ('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000007'),
  ('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000008'),
  ('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000009');

insert into public.parent_links (parent_id, student_id) values
  ('c1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000004');

-- ─── Shop ───
insert into public.shop_items (id, name, description, emoji, coin_price, stock, tier, sort_order) values
  ('5b000000-0000-0000-0000-000000000001', 'Zamin ruchkasi',      'Logotipli sifatli ruchka',                     '🖊️',   150, 200, 'small', 1),
  ('5b000000-0000-0000-0000-000000000002', 'Zamin daftari',       'A5 formatdagi logotipli daftar',               '📓',   300, 150, 'small', 2),
  ('5b000000-0000-0000-0000-000000000003', 'Zamin krujkasi',      'Logotipli keramik krujka',                     '☕',   600,  80, 'small', 3),
  ('5b000000-0000-0000-0000-000000000004', 'Zamin futbolkasi',    'Maktab logotipli futbolka',                    '👕',  1200,  50, 'small', 4),
  ('5b000000-0000-0000-0000-000000000005', 'Zamin xudisi',        'Issiq maktab xudisi',                          '🧥',  2500,  30, 'small', 5),
  ('5b000000-0000-0000-0000-000000000006', 'Kitob sertifikati',   '200 000 so''mlik kitob do''koni sertifikati',  '📚',  3000,  20, 'big',   6),
  ('5b000000-0000-0000-0000-000000000007', 'Simsiz quloqchinlar', 'AirPods yoki shunga o''xshash',                '🎧',  6000,   5, 'big',   7),
  ('5b000000-0000-0000-0000-000000000008', 'MacBook Air',         'Eng faol o''quvchi uchun bosh sovrin',         '💻', 10000,   2, 'big',   8),
  ('5b000000-0000-0000-0000-000000000009', 'Zamin stikerlari',    'Noutbuk uchun 10 ta stiker to''plami',         '✨',   100,   0, 'small', 0)
on conflict (id) do update set name = excluded.name, description = excluded.description, emoji = excluded.emoji,
  coin_price = excluded.coin_price, stock = excluded.stock, tier = excluded.tier, sort_order = excluded.sort_order, active = true;

update public.app_config
   set value = jsonb_set(value, '{item_id}', '"5b000000-0000-0000-0000-000000000008"')
 where key = 'big_goal';

-- ─── Challenges ───
insert into public.challenges (id, subject, title, description, type, recurrence, coins_reward, content, pass_score, streak_days, created_by) values
  ('d0000000-0000-0000-0000-000000000001', 'english', 'Kunlik so''zlar testi',
   '5 ta yangi so''z bo''yicha qisqa test', 'quiz', 'daily', 10,
   '{"questions":[
      {"id":"q1","text":"\"Diligent\" so''zining ma''nosi?","options":["Dangasa","Tirishqoq","Quvnoq"]},
      {"id":"q2","text":"\"Achieve\" so''zining ma''nosi?","options":["Erishmoq","Yo''qotmoq","Kutmoq"]},
      {"id":"q3","text":"\"Brief\" so''zining ma''nosi?","options":["Uzun","Qisqa","Og''ir"]}
   ]}', 60, null, 'a0000000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-000000000002', 'english', 'Essay: My dream school',
   '150–200 so''zlik insho yozing va yuklang', 'task', 'once', 40, '{}', 60, null, 'a0000000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-000000000003', 'english', '7 kunlik ingliz seriyasi',
   '7 kun ketma-ket ingliz tili vazifasini bajaring', 'streak', 'once', 100, '{}', 60, 7, 'a0000000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-000000000004', 'math', 'Kunlik misol',
   'Bugungi 3 ta misolni yeching', 'quiz', 'daily', 10,
   '{"questions":[
      {"id":"q1","text":"12 × 13 = ?","options":["146","156","166"]},
      {"id":"q2","text":"√144 = ?","options":["11","12","14"]},
      {"id":"q3","text":"2x + 6 = 14 bo''lsa, x = ?","options":["3","4","5"]}
   ]}', 60, null, 'a0000000-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000005', 'math', 'Olimpiada masalasi',
   'Haftalik qiyin masala — yechimni rasmga olib yuklang', 'task', 'once', 40, '{}', 60, null, 'a0000000-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000006', 'math', '7 kunlik matematika seriyasi',
   '7 kun ketma-ket matematika vazifasini bajaring', 'streak', 'once', 100, '{}', 60, 7, 'a0000000-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000007', 'it', 'IT viktorina',
   'Dasturlash asoslari bo''yicha test', 'quiz', 'daily', 10,
   '{"questions":[
      {"id":"q1","text":"HTML nima?","options":["Dasturlash tili","Belgilash tili","Ma''lumotlar bazasi"]},
      {"id":"q2","text":"Python''da ro''yxat qaysi qavsda yoziladi?","options":["()","{}","[]"]},
      {"id":"q3","text":"1 bayt necha bitdan iborat?","options":["4","8","16"]}
   ]}', 60, null, 'a0000000-0000-0000-0000-000000000003'),
  ('d0000000-0000-0000-0000-000000000008', 'it', 'Shaxsiy veb-sahifa',
   'HTML/CSS bilan o''zingiz haqingizda sahifa yarating va havolani yuboring', 'task', 'once', 60, '{}', 60, null, 'a0000000-0000-0000-0000-000000000003')
on conflict (id) do update set subject = excluded.subject, title = excluded.title, description = excluded.description,
  type = excluded.type, recurrence = excluded.recurrence, coins_reward = excluded.coins_reward, content = excluded.content,
  pass_score = excluded.pass_score, streak_days = excluded.streak_days, created_by = excluded.created_by, active = true;

insert into public.challenge_answer_keys (challenge_id, answers) values
  ('d0000000-0000-0000-0000-000000000001', '{"q1":1,"q2":0,"q3":1}'),
  ('d0000000-0000-0000-0000-000000000004', '{"q1":1,"q2":1,"q3":1}'),
  ('d0000000-0000-0000-0000-000000000007', '{"q1":1,"q2":2,"q3":1}')
on conflict (challenge_id) do update set answers = excluded.answers;

-- ─── Events (three finished with results, four upcoming) ───
insert into public.events (id, title, description, date, subject, coins_pool, created_by) values
  ('e0000000-0000-0000-0000-000000000001', 'Spelling Bee', 'Maktab ichki ingliz tili musobaqasi', current_date - 20, 'english', 2000, null),
  ('e0000000-0000-0000-0000-000000000004', 'Matematika kubogi', 'Sinflararo og''zaki hisob musobaqasi', current_date - 8, 'math', 1500, null),
  ('e0000000-0000-0000-0000-000000000002', 'Matematika olimpiadasi (maktab bosqichi)', '7–11 sinflar uchun', current_date + 10, 'math', 3000, null),
  ('e0000000-0000-0000-0000-000000000003', 'Hackathon: Zamin Code Day', 'Jamoaviy dasturlash marafoni', current_date + 24, 'it', 5000, null),
  ('e0000000-0000-0000-0000-000000000005', 'Ingliz tili debati', '9–11 sinflar o''rtasida "Should homework be banned?" mavzusida debat', current_date - 3, 'english', 1200, null),
  ('e0000000-0000-0000-0000-000000000006', 'Robototexnika ko''rgazmasi', 'O''quvchilar yasagan robotlar namoyishi va jamoaviy tanlov', current_date + 5, 'it', 2500, null),
  ('e0000000-0000-0000-0000-000000000007', 'Kitobxonlik tanlovi', 'Oy davomida eng ko''p kitob o''qigan o''quvchilarni taqdirlash', current_date + 40, null, null, null)
on conflict (id) do update set title = excluded.title, description = excluded.description, date = excluded.date,
  subject = excluded.subject, coins_pool = excluded.coins_pool;

delete from public.announcements where id::text like 'a1000000-0000-0000-0000-%';
insert into public.announcements (id, title, body, pinned, created_by, author_name, created_at) values
  ('a1000000-0000-0000-0000-000000000001', 'Xush kelibsiz, Zamin Students!',
   'Darsda faol bo''ling, vazifalarni bajaring va coin to''plang. Coinlarni do''konda sovg''alarga almashtirishingiz mumkin. Eng faol o''quvchi MacBook yutadi!',
   true, null, 'Maktab ma''muriyati', now() - interval '20 days'),
  ('a1000000-0000-0000-0000-000000000002', 'Matematika olimpiadasi — ro''yxatdan o''ting',
   'Maktab bosqichi 10 kundan keyin bo''lib o''tadi. Ro''yxatdan o''tish sinf rahbarida. G''oliblarga 300 coin!',
   false, 'a0000000-0000-0000-0000-000000000003', '', now() - interval '2 days'),
  ('a1000000-0000-0000-0000-000000000003', 'Spelling Bee natijalari',
   'Madina Aliyeva 1-o''rin, Kamola Xasanova 2-o''rin, Ali Valiyev 3-o''rin. Barcha ishtirokchilarga rahmat — har biriga 30 coin berildi!',
   false, 'a0000000-0000-0000-0000-000000000002', '', now() - interval '19 days'),
  ('a1000000-0000-0000-0000-000000000004', 'Do''konga yangi mahsulotlar keldi',
   'Zamin xudisi va futbolkalari endi do''konda. Stikerlar tez orada qayta keladi.',
   false, null, 'Maktab ma''muriyati', now() - interval '6 days'),
  ('a1000000-0000-0000-0000-000000000005', 'Robototexnika ko''rgazmasiga tayyorgarlik',
   'Jamoalar har payshanba 15:00 da IT xonasida yig''iladi. Robotingiz loyihasini o''qituvchiga ko''rsating.',
   false, 'a0000000-0000-0000-0000-000000000003', '', now() - interval '1 day'),
  ('a1000000-0000-0000-0000-000000000006', 'Ota-onalar majlisi',
   'Shanba kuni soat 10:00 da maktab zalida ota-onalar majlisi bo''ladi. Farzandingizning coin hisobotini ilovadan ko''rishingiz mumkin.',
   false, 'a0000000-0000-0000-0000-000000000002', '', now() - interval '4 days');

-- ─── Coin history (through the ledger, so balances stay consistent) ───
-- ~60 days of class-activity awards with varied activity per student.
insert into public.coin_transactions (user_id, amount, direction, category, subject, reason, awarded_by, created_at)
select s.id,
       (array[5, 5, 5, 10])[1 + floor(random() * 4)::int],
       'earn', 'class_activity',
       (array['english', 'math', 'it'])[1 + floor(random() * 3)::int]::public.subject,
       'Darsdagi faollik',
       (array['a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003'])[1 + floor(random() * 2)::int]::uuid,
       now() - (d || ' days')::interval - (floor(random() * 6) || ' hours')::interval
  from seed_users s
 cross join generate_series(1, 60) d
 cross join generate_series(1, 3) slot                               -- up to 3 lessons/day
 where s.role = 'student'
   and extract(dow from now() - (d || ' days')::interval) <> 0
   and random() < 0.35 + 0.05 * (right(s.id::text, 2)::int % 10);   -- some students are more active

-- ~30 days of passed daily quizzes (submission + ledger row each)
with picks as (
  select s.id as user_id, ch.id as challenge_id, ch.subject, ch.title, ch.coins_reward,
         (current_date - d) as day
    from seed_users s
   cross join generate_series(1, 30) d
   cross join public.challenges ch
   where s.role = 'student' and ch.type = 'quiz' and ch.recurrence = 'daily'
     and ch.id in ('d0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000007')
     and random() < 0.25
), subs as (
  insert into public.challenge_submissions (challenge_id, user_id, status, score, coins_awarded, submitted_on, reviewed_at, created_at)
  select challenge_id, user_id, 'approved', 100, coins_reward, day, day + interval '16 hours', day + interval '16 hours' from picks
  returning id, challenge_id, user_id, coins_awarded, created_at
)
insert into public.coin_transactions (user_id, amount, direction, category, subject, reason, ref_table, ref_id, created_at)
select subs.user_id, subs.coins_awarded, 'earn', 'challenge', ch.subject, ch.title, 'challenge_submissions', subs.id, subs.created_at
  from subs join public.challenges ch on ch.id = subs.challenge_id;

-- Event results (+ their ledger rows)
insert into public.event_results (event_id, user_id, place, coins_awarded, recorded_by) values
  ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 1, 300, 'a0000000-0000-0000-0000-000000000002'),
  ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004', 2, 200, 'a0000000-0000-0000-0000-000000000002'),
  ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000009', 3, 120, 'a0000000-0000-0000-0000-000000000002'),
  ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', null, 30, 'a0000000-0000-0000-0000-000000000002'),
  ('e0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000005', 1, 300, 'a0000000-0000-0000-0000-000000000003'),
  ('e0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000003', 2, 200, 'a0000000-0000-0000-0000-000000000003'),
  ('e0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 2, 200, 'a0000000-0000-0000-0000-000000000002'),
  ('e0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000004', 1, 300, 'a0000000-0000-0000-0000-000000000002'),
  ('e0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000005', null, 30, 'a0000000-0000-0000-0000-000000000002');

insert into public.coin_transactions (user_id, amount, direction, category, subject, reason, awarded_by, ref_table, ref_id, created_at)
select r.user_id, r.coins_awarded, 'earn', 'event', e.subject,
       e.title || coalesce(' — ' || r.place || '-o''rin', ''), r.recorded_by, 'event_results', r.id, e.date::timestamptz + interval '15 hours'
  from public.event_results r join public.events e on e.id = r.event_id
 where r.user_id in (select id from seed_users);

-- ─── Achievement catalog (what can be earned) ───
insert into public.achievement_catalog (id, type, title, description, emoji, coins, subject, sort_order) values
  ('ac000000-0000-0000-0000-000000000001', 'ielts',         'IELTS 6.5+',                 'Xalqaro ingliz tili sertifikati, umumiy ball 6.5 va undan yuqori', '🇬🇧', 1800, 'english', 1),
  ('ac000000-0000-0000-0000-000000000002', 'ielts',         'IELTS 7.5+',                 'Yuqori darajadagi IELTS natijasi',                                  '🏆', 3000, 'english', 2),
  ('ac000000-0000-0000-0000-000000000003', 'sat',           'SAT 1400+',                  'SAT imtihonida 1400 va undan yuqori ball',                          '🎓', 2400, 'math',    3),
  ('ac000000-0000-0000-0000-000000000004', 'national_cert', 'Milliy sertifikat (A)',      'Matematika bo''yicha milliy sertifikat, A daraja',                  '📜', 1200, 'math',    4),
  ('ac000000-0000-0000-0000-000000000005', 'olympiad',      'IT olimpiadasi — maktab',    'Maktab bosqichida sovrinli o''rin',                                 '💡',  250, 'it',      5),
  ('ac000000-0000-0000-0000-000000000006', 'olympiad',      'Matematika olimpiadasi — viloyat', 'Viloyat bosqichida sovrinli o''rin',                          '🧮', 1500, 'math',    6),
  ('ac000000-0000-0000-0000-000000000007', 'other',         'Spelling Bee g''olibi',      'Spelling Bee g''olibiga tadbir coinlaridan tashqari qo''shimcha bonus', '🐝',  300, 'english', 7),
  ('ac000000-0000-0000-0000-000000000008', 'olympiad',      'Respublika olimpiadasi',     'Respublika bosqichida sovrinli o''rin — eng katta yutuq',          '🥇', 4000, null,      8)
on conflict (id) do update set type = excluded.type, title = excluded.title, description = excluded.description,
  emoji = excluded.emoji, coins = excluded.coins, subject = excluded.subject, sort_order = excluded.sort_order, active = true;

-- ─── Students' achievements: earned (verified + coins), pending (admin queue), the rest stay locked ───
insert into public.achievements (id, user_id, catalog_id, type, title, subject, level, score, coins_awarded, status, created_at, verified_at) values
  -- Kamola: IELTS 7.5
  ('f0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004', 'ac000000-0000-0000-0000-000000000002', 'ielts', 'IELTS Academic 7.5', 'english', null, 7.5, 3000, 'verified', now() - interval '32 days', now() - interval '30 days'),
  -- Aziz (main demo student): two earned, one waiting for review
  ('f0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'ac000000-0000-0000-0000-000000000004', 'national_cert', 'Milliy sertifikat — matematika (A)', 'math', null, 82, 1200, 'verified', now() - interval '45 days', now() - interval '43 days'),
  ('f0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'ac000000-0000-0000-0000-000000000005', 'olympiad', 'IT olimpiadasi (maktab) — 2-o''rin', 'it', 'school', 2, 250, 'verified', now() - interval '25 days', now() - interval '24 days'),
  ('f0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'ac000000-0000-0000-0000-000000000001', 'ielts', 'IELTS Academic 6.5', 'english', null, 6.5, 0, 'pending', now() - interval '2 days', null),
  -- Madina: Spelling Bee winner
  ('f0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 'ac000000-0000-0000-0000-000000000007', 'other', 'Spelling Bee g''olibi', 'english', null, 1, 300, 'verified', now() - interval '20 days', now() - interval '19 days'),
  -- Bekzod: SAT waiting for review
  ('f0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000005', 'ac000000-0000-0000-0000-000000000003', 'sat', 'SAT 1420', 'math', null, 1420, 0, 'pending', now() - interval '1 day', null);

-- ledger rows for every verified achievement (that's where the coins come from)
insert into public.coin_transactions (user_id, amount, direction, category, subject, reason, ref_table, ref_id, created_at)
select a.user_id, a.coins_awarded, 'earn', 'achievement', a.subject, a.title, 'achievements', a.id, a.verified_at
  from public.achievements a
 where a.status = 'verified' and a.coins_awarded > 0 and a.user_id in (select id from seed_users);

-- ─── Demo shop orders: delivered, pending, approved ───
-- Must stay AFTER every 'earn' insert above. Each buyer is covered by
-- deterministic earnings, independent of the random history:
--   Madina  Spelling Bee 1st place 300            ≥ Zamin daftari 300
--   Kamola  IELTS 3000 + Spelling Bee 2nd 200     ≥ Zamin xudisi  2500
--   Aziz    milliy sertifikat 1200                ≥ Zamin ruchkasi 150
-- Each purchase is still checked against the live balance and stock, so a
-- plan that no longer fits is skipped with a NOTICE instead of tripping the
-- ledger's insufficient_coins check. Stock drops only for orders created.
-- Purchase timestamps fall after the earnings that pay for them.
do $$
declare
  p       record;
  v_item  public.shop_items;
  v_bal   int;
  v_order uuid;
begin
  for p in
    select * from (values
      ('b0000000-0000-0000-0000-000000000002'::uuid, '5b000000-0000-0000-0000-000000000002'::uuid,
       'delivered'::public.order_status, now() - interval '5 days'),
      ('b0000000-0000-0000-0000-000000000004'::uuid, '5b000000-0000-0000-0000-000000000005'::uuid,
       'pending'::public.order_status, now() - interval '1 day'),
      ('b0000000-0000-0000-0000-000000000001'::uuid, '5b000000-0000-0000-0000-000000000001'::uuid,
       'approved'::public.order_status, now() - interval '3 days')
    ) as t(user_id, item_id, status, at)
  loop
    select * into v_item from public.shop_items where id = p.item_id for update;
    select coin_balance into v_bal from public.profiles where id = p.user_id for update;

    if v_item.id is null or v_bal is null or v_item.stock < 1 or v_bal < v_item.coin_price then
      raise notice 'seed: skipped demo order % for % (balance %, price %, stock %)',
        v_item.name, p.user_id, v_bal, v_item.coin_price, v_item.stock;
      continue;
    end if;

    insert into public.orders (user_id, item_id, coin_cost, status, created_at)
    values (p.user_id, v_item.id, v_item.coin_price, p.status, p.at)
    returning id into v_order;

    insert into public.coin_transactions (user_id, amount, direction, category, reason, ref_table, ref_id, created_at)
    values (p.user_id, v_item.coin_price, 'spend', 'purchase', v_item.name, 'orders', v_order, p.at);

    update public.shop_items set stock = stock - 1 where id = v_item.id;
  end loop;
end $$;

-- ─── Show the demo accounts (SQL editor displays this result) ───
select p.role, p.full_name, p.login, 'Zamin2026!' as password, c.name as class
  from public.profiles p
  join seed_users u on u.id = p.id
  left join public.classes c on c.id = p.class_id
 order by u.ord;
