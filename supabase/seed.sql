-- ═══════════════════════════════════════════════════════════════════════════
--  Zamin Students — development seed  (runs on `supabase db reset`)
--  All accounts use password:  Zamin2026!
--    admin@zamin.uz · teacher.english@zamin.uz · teacher.math@zamin.uz
--    student1@zamin.uz … student12@zamin.uz
--  DO NOT run against production.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Classes ───
insert into public.classes (id, name, grade) values
  ('c0000000-0000-0000-0000-000000000007', '7-A', 7),
  ('c0000000-0000-0000-0000-000000000008', '8-A', 8),
  ('c0000000-0000-0000-0000-000000000009', '9-A', 9),
  ('c0000000-0000-0000-0000-000000000010', '10-A', 10);

-- ─── Auth users (profiles are created by the on_auth_user_created trigger) ───
create temporary table seed_users (id uuid, email text, full_name text, role public.user_role, class_id uuid) on commit drop;
insert into seed_users values
  ('a0000000-0000-0000-0000-000000000001', 'admin@zamin.uz',           'Dilnoza Karimova',   'admin',   null),
  ('a0000000-0000-0000-0000-000000000002', 'teacher.english@zamin.uz', 'Jasur Toshmatov',    'teacher', null),
  ('a0000000-0000-0000-0000-000000000003', 'teacher.math@zamin.uz',    'Malika Rahimova',    'teacher', null),
  ('b0000000-0000-0000-0000-000000000001', 'student1@zamin.uz',  'Aziz Yusupov',       'student', 'c0000000-0000-0000-0000-000000000009'),
  ('b0000000-0000-0000-0000-000000000002', 'student2@zamin.uz',  'Madina Aliyeva',     'student', 'c0000000-0000-0000-0000-000000000009'),
  ('b0000000-0000-0000-0000-000000000003', 'student3@zamin.uz',  'Sardor Nematov',     'student', 'c0000000-0000-0000-0000-000000000009'),
  ('b0000000-0000-0000-0000-000000000004', 'student4@zamin.uz',  'Kamola Xasanova',    'student', 'c0000000-0000-0000-0000-000000000010'),
  ('b0000000-0000-0000-0000-000000000005', 'student5@zamin.uz',  'Bekzod Ergashev',    'student', 'c0000000-0000-0000-0000-000000000010'),
  ('b0000000-0000-0000-0000-000000000006', 'student6@zamin.uz',  'Nilufar Saidova',    'student', 'c0000000-0000-0000-0000-000000000010'),
  ('b0000000-0000-0000-0000-000000000007', 'student7@zamin.uz',  'Otabek Mirzayev',    'student', 'c0000000-0000-0000-0000-000000000008'),
  ('b0000000-0000-0000-0000-000000000008', 'student8@zamin.uz',  'Shahzoda Qodirova',  'student', 'c0000000-0000-0000-0000-000000000008'),
  ('b0000000-0000-0000-0000-000000000009', 'student9@zamin.uz',  'Javohir Umarov',     'student', 'c0000000-0000-0000-0000-000000000008'),
  ('b0000000-0000-0000-0000-000000000010', 'student10@zamin.uz', 'Sevara Abdullayeva', 'student', 'c0000000-0000-0000-0000-000000000007'),
  ('b0000000-0000-0000-0000-000000000011', 'student11@zamin.uz', 'Ulug''bek Sobirov',  'student', 'c0000000-0000-0000-0000-000000000007'),
  ('b0000000-0000-0000-0000-000000000012', 'student12@zamin.uz', 'Zarina Hamidova',    'student', 'c0000000-0000-0000-0000-000000000007');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       crypt('Zamin2026!', gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.full_name),
       now() - interval '90 days', now(), '', '', '', ''
  from seed_users u;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
  from seed_users u;

-- No JWT in this session, so the role/class guard allows server-side changes.
update public.profiles p set role = u.role, class_id = u.class_id
  from seed_users u where p.id = u.id;

-- ─── Shop ───
insert into public.shop_items (name, description, coin_price, stock, tier, sort_order) values
  ('Zamin ruchkasi',          'Logotipli sifatli ruchka',                       150,  200, 'small', 1),
  ('Zamin daftari',           'A5 formatdagi logotipli daftar',                 300,  150, 'small', 2),
  ('Zamin krujkasi',          'Logotipli keramik krujka',                       600,   80, 'small', 3),
  ('Zamin futbolkasi',        'Maktab logotipli futbolka',                     1200,   50, 'small', 4),
  ('Zamin xudisi',            'Issiq maktab xudisi',                           2500,   30, 'small', 5),
  ('Kitob sertifikati',       '200 000 so''mlik kitob do''koni sertifikati',   3000,   20, 'big',   6),
  ('Simsiz quloqchinlar',     'AirPods yoki shunga o''xshash',                 6000,    5, 'big',   7),
  ('MacBook Air',             'Eng faol o''quvchi uchun bosh sovrin',         10000,    2, 'big',   8);

update public.app_config
   set value = jsonb_set(value, '{item_id}', to_jsonb((select id from public.shop_items where name = 'MacBook Air')))
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
   'HTML/CSS bilan o''zingiz haqingizda sahifa yarating va havolani yuboring', 'task', 'once', 60, '{}', 60, null, 'a0000000-0000-0000-0000-000000000003');

insert into public.challenge_answer_keys (challenge_id, answers) values
  ('d0000000-0000-0000-0000-000000000001', '{"q1":1,"q2":0,"q3":1}'),
  ('d0000000-0000-0000-0000-000000000004', '{"q1":1,"q2":1,"q3":1}'),
  ('d0000000-0000-0000-0000-000000000007', '{"q1":1,"q2":2,"q3":1}');

-- ─── Events ───
insert into public.events (id, title, description, date, subject, coins_pool, created_by) values
  ('e0000000-0000-0000-0000-000000000001', 'Spelling Bee', 'Maktab ichki ingliz tili musobaqasi', current_date - 20, 'english', 2000, 'a0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000002', 'Matematika olimpiadasi (maktab bosqichi)', '7–11 sinflar uchun', current_date + 10, 'math', 3000, 'a0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000003', 'Hackathon: Zamin Code Day', 'Jamoaviy dasturlash marafoni', current_date + 24, 'it', 5000, 'a0000000-0000-0000-0000-000000000001');

insert into public.announcements (title, body, pinned, created_by) values
  ('Xush kelibsiz, Zamin Students!', 'Darsda faol bo''ling, vazifalarni bajaring va coin to''plang. Eng faol o''quvchi MacBook yutadi!', true, 'a0000000-0000-0000-0000-000000000001'),
  ('Matematika olimpiadasi', 'Ro''yxatdan o''tish sinf rahbarida. G''oliblarga 300 coin!', false, 'a0000000-0000-0000-0000-000000000003');

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

-- Spelling Bee results
insert into public.event_results (event_id, user_id, place, coins_awarded, recorded_by) values
  ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 1, 300, 'a0000000-0000-0000-0000-000000000002'),
  ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004', 2, 200, 'a0000000-0000-0000-0000-000000000002'),
  ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000009', 3, 120, 'a0000000-0000-0000-0000-000000000002'),
  ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', null, 30, 'a0000000-0000-0000-0000-000000000002');

insert into public.coin_transactions (user_id, amount, direction, category, subject, reason, awarded_by, ref_table, ref_id, created_at)
select r.user_id, r.coins_awarded, 'earn', 'event', 'english',
       'Spelling Bee' || coalesce(' — ' || r.place || '-o''rin', ''), r.recorded_by, 'event_results', r.id, now() - interval '20 days'
  from public.event_results r;

-- Verified IELTS for a high achiever + one pending certificate for the admin queue
insert into public.achievements (id, user_id, type, title, subject, score, coins_awarded, status, verified_by, verified_at, created_at) values
  ('f0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004', 'ielts', 'IELTS Academic 7.5', 'english', 7.5, 3000, 'verified',
   'a0000000-0000-0000-0000-000000000001', now() - interval '30 days', now() - interval '32 days');
insert into public.achievements (user_id, type, title, subject, score, status) values
  ('b0000000-0000-0000-0000-000000000005', 'sat', 'SAT 1420', 'math', 1420, 'pending');

insert into public.coin_transactions (user_id, amount, direction, category, subject, reason, awarded_by, ref_table, ref_id, created_at) values
  ('b0000000-0000-0000-0000-000000000004', 3000, 'earn', 'achievement', 'english', 'IELTS Academic 7.5',
   'a0000000-0000-0000-0000-000000000001', 'achievements', 'f0000000-0000-0000-0000-000000000001', now() - interval '30 days');

-- One delivered and one pending order
with o as (
  insert into public.orders (user_id, item_id, coin_cost, status, created_at)
  select 'b0000000-0000-0000-0000-000000000002', id, coin_price, 'delivered', now() - interval '5 days'
    from public.shop_items where name = 'Zamin daftari'
  returning *
)
insert into public.coin_transactions (user_id, amount, direction, category, reason, ref_table, ref_id, created_at)
select o.user_id, o.coin_cost, 'spend', 'purchase', 'Zamin daftari', 'orders', o.id, o.created_at from o;

with o as (
  insert into public.orders (user_id, item_id, coin_cost, status)
  select 'b0000000-0000-0000-0000-000000000004', id, coin_price, 'pending'
    from public.shop_items where name = 'Zamin xudisi'
  returning *
)
insert into public.coin_transactions (user_id, amount, direction, category, reason, ref_table, ref_id)
select o.user_id, o.coin_cost, 'spend', 'purchase', 'Zamin xudisi', 'orders', o.id from o;

update public.shop_items set stock = stock - 1 where name in ('Zamin daftari', 'Zamin xudisi');
