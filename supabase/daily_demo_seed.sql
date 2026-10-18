-- ═══════════════════════════════════════════════════════════════════════════
--  Zamin Students — DEMO seed for daily tasks (dev only, NOT auto-run)
--  Run in the dev SQL editor AFTER the 20261020000000_daily_tasks migration.
--  Safe to re-run: levels upsert on (subject, ord), bank items and keys on fixed ids.
--
--  Levels: English A1/A2/B1 · Math 1/2/3 · IT 1/2/3.
--  Bank items only at the LOWEST level of each subject:
--    English A1: 8 grammar, 5 reading, 2 writing · Math 1: 12 · IT 1: 12
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.levels (subject, ord, name) values
  ('english', 1, 'A1'), ('english', 2, 'A2'), ('english', 3, 'B1'),
  ('math', 1, '1-daraja'), ('math', 2, '2-daraja'), ('math', 3, '3-daraja'),
  ('it', 1, '1-daraja'), ('it', 2, '2-daraja'), ('it', 3, '3-daraja')
on conflict (subject, ord) do update set name = excluded.name, active = true;

-- One statement: bank rows, then their keys (text items have none).
with d (id, subject, skill, mode, prompt, body, key) as (values
  -- ── English A1 · grammar
  ('d1000000-0000-0000-0000-000000000001', 'english', 'grammar', 'choice', 'She ___ a teacher.',            '{"options": ["am", "is", "are"]}', '{"correct": 1}'),
  ('d1000000-0000-0000-0000-000000000002', 'english', 'grammar', 'choice', 'They ___ from Tashkent.',       '{"options": ["is", "are", "am"]}', '{"correct": 1}'),
  ('d1000000-0000-0000-0000-000000000003', 'english', 'grammar', 'choice', 'I ___ two brothers.',           '{"options": ["has", "have", "haves"]}', '{"correct": 1}'),
  ('d1000000-0000-0000-0000-000000000004', 'english', 'grammar', 'choice', 'He ___ football every Sunday.', '{"options": ["play", "plays", "playing"]}', '{"correct": 1}'),
  ('d1000000-0000-0000-0000-000000000005', 'english', 'grammar', 'choice', 'There ___ a book on the table.', '{"options": ["is", "are", "be"]}', '{"correct": 0}'),
  ('d1000000-0000-0000-0000-000000000006', 'english', 'grammar', 'choice', 'We ___ like coffee.',           '{"options": ["doesn''t", "don''t", "isn''t"]}', '{"correct": 1}'),
  ('d1000000-0000-0000-0000-000000000007', 'english', 'grammar', 'choice', '___ you speak English?',        '{"options": ["Do", "Does", "Are"]}', '{"correct": 0}'),
  ('d1000000-0000-0000-0000-000000000008', 'english', 'grammar', 'exact',  'Write the plural of "child".',  '{}', '{"value": "children"}'),
  -- ── English A1 · reading
  ('d1000000-0000-0000-0000-000000000011', 'english', 'reading', 'choice', 'Where does Aziz live?',
     '{"passage": "Aziz lives in Samarkand. He is 12 years old. He goes to school by bus. His favourite subject is English.", "options": ["Tashkent", "Samarkand", "Bukhara"]}', '{"correct": 1}'),
  ('d1000000-0000-0000-0000-000000000012', 'english', 'reading', 'exact', 'How old is Aziz? (write a number)',
     '{"passage": "Aziz lives in Samarkand. He is 12 years old. He goes to school by bus. His favourite subject is English."}', '{"value": "12"}'),
  ('d1000000-0000-0000-0000-000000000013', 'english', 'reading', 'choice', 'How does Aziz go to school?',
     '{"passage": "Aziz lives in Samarkand. He is 12 years old. He goes to school by bus. His favourite subject is English.", "options": ["by bike", "on foot", "by bus"]}', '{"correct": 2}'),
  ('d1000000-0000-0000-0000-000000000014', 'english', 'reading', 'choice', 'What colour is the cat?',
     '{"passage": "Malika has a cat. The cat is white and its name is Oq. It likes milk.", "options": ["black", "white", "grey"]}', '{"correct": 1}'),
  ('d1000000-0000-0000-0000-000000000015', 'english', 'reading', 'exact', 'What does the cat like? (one word)',
     '{"passage": "Malika has a cat. The cat is white and its name is Oq. It likes milk."}', '{"value": "milk"}'),
  -- ── English A1 · writing (teacher-reviewed)
  ('d1000000-0000-0000-0000-000000000021', 'english', 'writing', 'text', 'Write 3–5 sentences about your family.',               '{"min_words": 20}', null),
  ('d1000000-0000-0000-0000-000000000022', 'english', 'writing', 'text', 'Describe your favourite day of the week (3–5 sentences).', '{"min_words": 20}', null),
  -- ── Math 1
  ('d2000000-0000-0000-0000-000000000001', 'math', 'math', 'exact',  '7 × 8 = ?',          '{}', '{"value": "56"}'),
  ('d2000000-0000-0000-0000-000000000002', 'math', 'math', 'exact',  '125 + 375 = ?',      '{}', '{"value": "500"}'),
  ('d2000000-0000-0000-0000-000000000003', 'math', 'math', 'exact',  '1000 − 457 = ?',     '{}', '{"value": "543"}'),
  ('d2000000-0000-0000-0000-000000000004', 'math', 'math', 'exact',  '84 : 7 = ?',         '{}', '{"value": "12"}'),
  ('d2000000-0000-0000-0000-000000000005', 'math', 'math', 'choice', 'Qaysi son eng katta?', '{"options": ["0,5", "0,45", "0,505"]}', '{"correct": 2}'),
  ('d2000000-0000-0000-0000-000000000006', 'math', 'math', 'exact',  '3/4 ni o''nli kasr ko''rinishida yozing.', '{}', '{"value": "0.75"}'),
  ('d2000000-0000-0000-0000-000000000007', 'math', 'math', 'exact',  'Kvadratning tomoni 6 sm. Perimetri necha sm?', '{}', '{"value": "24"}'),
  ('d2000000-0000-0000-0000-000000000008', 'math', 'math', 'exact',  '2x + 3 = 11. x = ?', '{}', '{"value": "4"}'),
  ('d2000000-0000-0000-0000-000000000009', 'math', 'math', 'choice', 'Qaysi son tub?',     '{"options": ["21", "27", "29", "33"]}', '{"correct": 2}'),
  ('d2000000-0000-0000-0000-000000000010', 'math', 'math', 'exact',  '200 ning 15% i nechaga teng?', '{}', '{"value": "30"}'),
  ('d2000000-0000-0000-0000-000000000011', 'math', 'math', 'exact',  'Uchburchak burchaklari yig''indisi necha gradus?', '{}', '{"value": "180"}'),
  ('d2000000-0000-0000-0000-000000000012', 'math', 'math', 'choice', '(−3) × (−4) = ?',    '{"options": ["−12", "12", "−7", "7"]}', '{"correct": 1}'),
  -- ── IT 1
  ('d3000000-0000-0000-0000-000000000001', 'it', 'it', 'choice', 'Kompyuterning "miyasi" deb qaysi qism ataladi?', '{"options": ["Monitor", "Protsessor (CPU)", "Klaviatura"]}', '{"correct": 1}'),
  ('d3000000-0000-0000-0000-000000000002', 'it', 'it', 'exact',  '1 bayt necha bitdan iborat?', '{}', '{"value": "8"}'),
  ('d3000000-0000-0000-0000-000000000003', 'it', 'it', 'choice', 'Qaysi biri kirish qurilmasi?', '{"options": ["Printer", "Sichqoncha", "Monitor"]}', '{"correct": 1}'),
  ('d3000000-0000-0000-0000-000000000004', 'it', 'it', 'exact',  'Ikkilik sanoq sistemasidagi 101 o''nlik sistemada nechaga teng?', '{}', '{"value": "5"}'),
  ('d3000000-0000-0000-0000-000000000005', 'it', 'it', 'choice', 'HTML nima uchun ishlatiladi?', '{"options": ["Veb-sahifa tuzilmasi", "Rasm tahrirlash", "Ma''lumotlar bazasi"]}', '{"correct": 0}'),
  ('d3000000-0000-0000-0000-000000000006', 'it', 'it', 'exact',  'Python''da ekranga chiqaradigan funksiya nomi?', '{}', '{"value": "print"}'),
  ('d3000000-0000-0000-0000-000000000007', 'it', 'it', 'choice', 'Qaysi biri operatsion tizim?', '{"options": ["Windows", "Excel", "Chrome"]}', '{"correct": 0}'),
  ('d3000000-0000-0000-0000-000000000008', 'it', 'it', 'choice', 'Ctrl + C nima qiladi?', '{"options": ["Kesib oladi", "Nusxa oladi", "Qo''yadi"]}', '{"correct": 1}'),
  ('d3000000-0000-0000-0000-000000000009', 'it', 'it', 'exact',  '8 sonini ikkilik sistemada yozing.', '{}', '{"value": "1000"}'),
  ('d3000000-0000-0000-0000-000000000010', 'it', 'it', 'choice', 'Qaysi biri brauzer?', '{"options": ["Word", "Firefox", "Paint"]}', '{"correct": 1}'),
  ('d3000000-0000-0000-0000-000000000011', 'it', 'it', 'exact',  'print(2 + 3 * 2) natijasi nima?', '{}', '{"value": "8"}'),
  ('d3000000-0000-0000-0000-000000000012', 'it', 'it', 'choice', 'Qaysi parol eng kuchli?', '{"options": ["123456", "qwerty", "T7#mK9!pQ2"]}', '{"correct": 2}')
),
bank as (
  insert into public.task_bank (id, subject, level_id, skill, answer_mode, prompt, body)
  select d.id::uuid, d.subject::public.subject, l.id, d.skill::public.task_skill, d.mode::public.answer_mode, d.prompt, d.body::jsonb
    from d join public.levels l on l.subject = d.subject::public.subject and l.ord = 1
  on conflict (id) do update
     set subject = excluded.subject, level_id = excluded.level_id, skill = excluded.skill,
         answer_mode = excluded.answer_mode, prompt = excluded.prompt, body = excluded.body, active = true
  returning id
)
insert into public.task_bank_keys (task_id, answer)
select bank.id, d.key::jsonb from bank join d on d.id::uuid = bank.id
 where d.key is not null
on conflict (task_id) do update set answer = excluded.answer;

-- What was seeded
select l.subject, l.name as level, t.skill, count(*) as items, count(k.task_id) as with_key
  from public.task_bank t
  join public.levels l on l.id = t.level_id
  left join public.task_bank_keys k on k.task_id = t.id
 where t.id::text like 'd_000000-%'
 group by l.subject, l.ord, l.name, t.skill
 order by l.subject, l.ord, t.skill;
