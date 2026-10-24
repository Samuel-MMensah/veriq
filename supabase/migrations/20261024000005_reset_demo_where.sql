-- Fix for 20261024000004: Supabase runs pg-safeupdate on API calls, which refuses a DELETE without a
-- WHERE clause. reset_demo() cleared search_daily with a bare DELETE, so "Reset demo data" failed on
-- Supabase (PGlite, used in tests, doesn't have that extension). Same function, with "where true".
create or replace function public.reset_demo() returns void
  language plpgsql security definer set search_path = public
  as $reset$
begin

  -- Clear previous sample data. Child rows go with their facility (on delete cascade).
  delete from public.facilities where is_sample;
  delete from public.search_daily where true; -- Supabase refuses a DELETE without WHERE over the API

  -- Services ---------------------------------------------------------------------
  insert into public.services (id, name, category) values
    ('antenatal',    'Antenatal clinic', 'maternity'),
    ('delivery',     'Delivery',         'maternity'),
    ('c_section',    'C-section',        'maternity'),
    ('emergency',    'Emergency unit',   'emergency'),
    ('ultrasound',   'Ultrasound scan',  'scan'),
    ('xray',         'X-ray',            'scan'),
    ('ct',           'CT scan',          'scan'),
    ('lab',          'Lab test',         'lab'),
    ('gp',           'See a doctor',     'doctor'),
    ('paediatrics',  'Children''s doctor', 'specialist'),
    ('dental',       'Dental',           'dental'),
    ('obstetrician', 'Obstetrician',     'specialist')
  on conflict (id) do update set name = excluded.name, category = excluded.category;

  -- Insurers: the three named in section 3 plus two invented private insurers ------
  insert into public.insurers (id, slug, name, kind) values
    ('a0000000-0000-4000-8000-000000000001', 'nhis',         'NHIS',                'public'),
    ('a0000000-0000-4000-8000-000000000002', 'cosmopolitan', 'Cosmopolitan Health', 'private'),
    ('a0000000-0000-4000-8000-000000000003', 'prudential',   'Prudential',          'private'),
    ('a0000000-0000-4000-8000-000000000004', 'sika-health',  'Sika Health',         'private'),
    ('a0000000-0000-4000-8000-000000000005', 'adom-care',    'Adom Care',           'private')
  on conflict (id) do update set slug = excluded.slug, name = excluded.name, kind = excluded.kind;

  -- Facilities: 18 invented names in Greater Accra -------------------------------

  insert into public.facilities (id, name, type, region, district, area, lat, lng, phone, verified, verified_at, nhia_listed, is_sample)
  select s.id, v.name, v.type, 'Greater Accra', v.district, v.area, v.lat, v.lng,
         '+233 000 000 ' || lpad(right(s.id::text, 3), 3, '0'),
         v.verified, case when v.verified then now() - interval '60 days' end, v.nhia_listed, true
  from (values
    ('akoma',       'Akoma Mission Hospital',        'mission', 'Ablekuma Central',         'Kaneshie',          5.55645, -0.25350, true,  false),
    ('lakeside',    'Lakeside Family Clinic',        'private', 'Ablekuma West',            'Dansoman',          5.54296, -0.28840, false, true),
    ('gbawe',       'Gbawe Community Clinic',        'public',  'Weija-Gbawe',              'Gbawe',             5.55894, -0.28926, false, true),
    ('pinecrest',   'Pinecrest Specialist Hospital', 'private', 'Ablekuma North',           'Mataheko',          5.57373, -0.25449, true,  true),
    ('westhills',   'Westhills District Hospital',   'public',  'Weija-Gbawe',              'Weija',             5.55156, -0.30237, true,  true),
    ('royalpalm',   'Royal Palm Maternity Home',     'private', 'Ablekuma South',           'Mamprobi',          5.54328, -0.24520, false, false),
    ('glefe',       'Glefe Seaside Clinic',          'private', 'Ablekuma West',            'Glefe',             5.53468, -0.27980, false, false),
    ('sunrise',     'Sunrise Dental Centre',         'private', 'Ablekuma Central',         'Kaneshie',          5.55579, -0.24622, false, true),
    ('unity',       'Unity Diagnostic Centre',       'private', 'Okaikwei South',           'Abossey Okai',      5.56697, -0.23870, false, true),
    ('mercy',       'Mercy Grace Clinic',            'mission', 'Ablekuma North',           'Odorkor',           5.58083, -0.28578, true,  true),
    ('littlesteps', 'Little Steps Children''s Clinic', 'private', 'Ablekuma South',         'Dansoman',          5.54313, -0.25432, false, true),
    ('greenfield',  'Greenfield Polyclinic',         'public',  'Okaikwei North',           'Achimota',          5.61045, -0.20982, true,  true),
    ('labadi',      'Labadi Coast Hospital',         'private', 'La Dade-Kotopon',          'Labadi',            5.56608, -0.14487, false, true),
    ('harbourview', 'Harbourview Clinic',            'private', 'Tema Metropolitan',        'Tema Community 1',  5.60785, -0.02935, false, true),
    ('madina',      'Madina Family Hospital',        'private', 'La Nkwantanang-Madina',    'Madina',            5.66556, -0.16336, false, true),
    ('ashaiman',    'Ashaiman Hope Clinic',          'private', 'Ashaiman',                 'Ashaiman',          5.63112, -0.02726, false, true),
    ('amasaman',    'Amasaman Valley Hospital',      'public',  'Ga West',                  'Amasaman',          5.70442, -0.29324, false, true),
    ('teshie',      'Teshie Lighthouse Clinic',      'private', 'Ledzokuku',                'Teshie',            5.55989, -0.09398, false, true)
  ) as v(code, name, type, district, area, lat, lng, verified, nhia_listed)
  cross join lateral (select public.demo_facility_id(v.code) as id) s;

  -- What each facility offers ---------------------------------------------------------
  insert into public.facility_services (facility_id, service_id, offered, usual_hours)
  select s.id, v.service_id, true, v.usual_hours
  from (values
    ('akoma', 'antenatal', 'Mon to Fri, 8 am to 4 pm'), ('akoma', 'delivery', '24 hours'), ('akoma', 'c_section', null),
    ('akoma', 'emergency', '24 hours'), ('akoma', 'ultrasound', 'Mon to Sat'), ('akoma', 'obstetrician', null),
    ('akoma', 'lab', null), ('akoma', 'gp', null),
    ('lakeside', 'antenatal', 'Tue and Thu'), ('lakeside', 'gp', null), ('lakeside', 'lab', null),
    ('gbawe', 'antenatal', null), ('gbawe', 'gp', null),
    ('pinecrest', 'antenatal', null), ('pinecrest', 'emergency', '24 hours'), ('pinecrest', 'obstetrician', null),
    ('pinecrest', 'ultrasound', null), ('pinecrest', 'ct', null), ('pinecrest', 'gp', null), ('pinecrest', 'paediatrics', null),
    ('westhills', 'emergency', '24 hours'), ('westhills', 'gp', null), ('westhills', 'lab', null),
    ('westhills', 'xray', null), ('westhills', 'paediatrics', null), ('westhills', 'dental', null),
    ('royalpalm', 'antenatal', 'Mon, Wed, Fri'), ('royalpalm', 'delivery', '24 hours'),
    ('glefe', 'antenatal', null), ('glefe', 'gp', null),
    ('sunrise', 'dental', 'Mon to Sat'),
    ('unity', 'ultrasound', null), ('unity', 'xray', null), ('unity', 'ct', null), ('unity', 'lab', null),
    ('mercy', 'gp', null), ('mercy', 'lab', null), ('mercy', 'paediatrics', null),
    ('littlesteps', 'paediatrics', null), ('littlesteps', 'gp', null),
    ('greenfield', 'gp', null), ('greenfield', 'lab', null), ('greenfield', 'antenatal', null),
    ('labadi', 'gp', null), ('labadi', 'ultrasound', null), ('labadi', 'lab', null),
    ('harbourview', 'gp', null), ('harbourview', 'antenatal', null), ('harbourview', 'emergency', '24 hours'),
    ('madina', 'gp', null), ('madina', 'antenatal', null), ('madina', 'lab', null), ('madina', 'emergency', '24 hours'),
    ('ashaiman', 'gp', null), ('ashaiman', 'lab', null),
    ('amasaman', 'gp', null), ('amasaman', 'antenatal', null), ('amasaman', 'delivery', null), ('amasaman', 'emergency', '24 hours'),
    ('teshie', 'gp', null), ('teshie', 'dental', null)
  ) as v(code, service_id, usual_hours)
  cross join lateral (select public.demo_facility_id(v.code) as id) s;

  -- Status updates (rule F). Ages are in minutes before now(). ----------------------------
  insert into public.status_updates (facility_id, service_id, status, from_time, note, source, created_at)
  select s.id, v.service_id, v.status, v.from_time::time, v.note, 'hospital', now() - make_interval(mins => v.age_min)
  from (values
    -- Akoma morning check, 40 minutes ago (under 24 h). An older "closed" row shows that the newest row wins.
    ('akoma', 'antenatal', 'closed', null, null, 1480),
    ('akoma', 'antenatal', 'open', null, 'Open till 4 pm', 40),
    ('akoma', 'emergency', 'accepting', null, null, 40),
    ('akoma', 'ultrasound', 'working', null, null, 40),
    ('akoma', 'obstetrician', 'from_time', '14:00', null, 40),
    -- Lakeside: 30 hours old, so "may have changed" (24 to 72 h).
    ('lakeside', 'antenatal', 'open', null, null, 1800),
    -- Gbawe: no rows at all, so "No update yet".
    ('pinecrest', 'emergency', 'full', null, null, 15),
    ('pinecrest', 'antenatal', 'open', null, null, 180),
    ('westhills', 'emergency', 'accepting', null, null, 120),
    -- Westhills X-ray: 5 days old, so greyed "not updated recently" (over 72 h).
    ('westhills', 'xray', 'working', null, null, 7200),
    ('royalpalm', 'antenatal', 'closed', null, null, 300),
    ('glefe', 'antenatal', 'open', null, null, 180),
    ('sunrise', 'dental', 'open', null, null, 360),
    ('unity', 'ultrasound', 'working', null, null, 120),
    ('unity', 'ct', 'down', null, null, 60),
    ('mercy', 'gp', 'open', null, null, 60),
    ('littlesteps', 'paediatrics', 'open', null, null, 60),
    ('greenfield', 'antenatal', 'open', null, null, 240),
    ('harbourview', 'emergency', 'accepting', null, null, 180),
    ('madina', 'emergency', 'full', null, null, 60)
  ) as v(code, service_id, status, from_time, note, age_min)
  cross join lateral (select public.demo_facility_id(v.code) as id) s;

  -- Lists and hospital answers (rule B). Confirmation ages in days. -----------------------
  insert into public.facility_insurers (facility_id, insurer_id, listed_by, hospital_says, hospital_confirmed_at)
  select s.id, i.id, v.listed_by, v.hospital_says,
         case when v.confirmed_days is not null then now() - make_interval(days => v.confirmed_days) end
  from (values
    ('akoma',       'nhis',         'none',    'accepts',  2),
    ('akoma',       'cosmopolitan', 'insurer', 'accepts',  2),
    ('akoma',       'prudential',   'insurer', null,       null),
    ('lakeside',    'nhis',         'nhia',    null,       null),
    ('gbawe',       'nhis',         'nhia',    null,       null),
    ('pinecrest',   'nhis',         'nhia',    'accepts',  12),
    ('pinecrest',   'cosmopolitan', 'insurer', 'accepts',  3),
    ('westhills',   'nhis',         'nhia',    null,       null),
    ('westhills',   'cosmopolitan', 'insurer', null,       null),
    ('royalpalm',   'nhis',         'none',    'does_not', 5),
    ('royalpalm',   'cosmopolitan', 'insurer', 'partial',  3),
    ('sunrise',     'nhis',         'nhia',    null,       null),
    ('unity',       'nhis',         'nhia',    null,       null),
    ('unity',       'prudential',   'insurer', 'accepts',  20),
    ('mercy',       'nhis',         'nhia',    'accepts',  1),
    ('littlesteps', 'nhis',         'nhia',    null,       null),
    ('littlesteps', 'sika-health',  'insurer', 'partial',  10),
    ('greenfield',  'nhis',         'nhia',    null,       null),
    ('labadi',      'nhis',         'nhia',    null,       null),
    ('labadi',      'cosmopolitan', 'insurer', 'accepts',  3),
    ('harbourview', 'nhis',         'nhia',    'accepts',  25),
    ('madina',      'nhis',         'nhia',    null,       null),
    ('ashaiman',    'nhis',         'nhia',    null,       null),
    ('amasaman',    'nhis',         'nhia',    null,       null),
    ('amasaman',    'adom-care',    'insurer', null,       null),
    ('teshie',      'nhis',         'nhia',    null,       null),
    ('teshie',      'adom-care',    'none',    'does_not', 3)
  ) as v(code, card, listed_by, hospital_says, confirmed_days)
  cross join lateral (select public.demo_facility_id(v.code) as id) s
  join public.insurers i on i.slug = v.card;

  -- Patient reports. Each listed age (in days) is one report; device hashes are random. --------
  insert into public.card_reports (facility_id, insurer_id, service_id, outcome, amount_ghs, item, device_hash, state, created_at)
  select s.id, i.id, v.service_id, v.outcome, v.amount_ghs, v.item,
         encode(sha256(convert_to('seed:' || gen_random_uuid()::text, 'UTF8')), 'hex'),
         v.state, now() - make_interval(days => d.age) - interval '2 hours'
  from (values
    -- Akoma/NHIS: 9 accepted this month ("9 patients agree"); 3 scan top-ups of GH¢ 80 this week (rule T).
    ('akoma', 'nhis', 'antenatal', 'covered', null::numeric, null, 'live', array[2, 6, 9, 13, 17, 22]),
    ('akoma', 'nhis', 'ultrasound', 'topup', 80, 'scan', 'live', array[1, 3, 5]),
    ('akoma', 'nhis', 'antenatal', 'refused', null, null, 'live', array[40]),        -- older than 30 days
    ('akoma', 'cosmopolitan', 'antenatal', 'covered', null, null, 'live', array[4, 11]),
    -- Lakeside/NHIS: 14 patients confirmed this month (rule B3).
    ('lakeside', 'nhis', 'antenatal', 'covered', null, null, 'live', array[1, 2, 3, 5, 6, 8, 10, 12, 14, 16, 19, 21, 24, 27]),
    -- Gbawe/NHIS: one report only, so still "not checked" (rule B4).
    ('gbawe', 'nhis', 'antenatal', 'covered', null, null, 'live', array[5]),
    -- Pinecrest/NHIS: 9 refusals this month, 3 of them after the hospital's answer 12 days ago (rule B1).
    ('pinecrest', 'nhis', 'antenatal', 'refused', null, null, 'live', array[0, 4, 8, 14, 16, 18, 20, 23, 26]),
    ('pinecrest', 'nhis', 'antenatal', 'refused', null, null, 'live', array[45]),    -- older than 30 days
    ('pinecrest', 'nhis', 'antenatal', 'refused', null, null, 'held', array[0]),     -- held never counts (rule A)
    ('pinecrest', 'nhis', 'antenatal', 'refused', null, null, 'rejected', array[1]), -- rejected never counts (rule A)
    ('pinecrest', 'cosmopolitan', 'antenatal', 'covered', null, null, 'live', array[2, 7, 15, 21]),
    ('westhills', 'nhis', 'emergency', 'covered', null, null, 'live', array[3, 8, 12, 19, 25]),
    -- Royal Palm/Cosmopolitan: drugs top-ups GH¢ 50 and 60; the hospital later corrected it (rule T).
    ('royalpalm', 'cosmopolitan', 'antenatal', 'topup', 50, 'drugs', 'live', array[20]),
    ('royalpalm', 'cosmopolitan', 'antenatal', 'topup', 60, 'drugs', 'live', array[10]),
    -- Unity/Prudential: exactly 3 accepted (threshold of rule B3).
    ('unity', 'prudential', 'ultrasound', 'covered', null, null, 'live', array[4, 9, 16]),
    -- Little Steps/NHIS: exactly 3 accepted (threshold of rule B3).
    ('littlesteps', 'nhis', 'paediatrics', 'covered', null, null, 'live', array[3, 10, 18]),
    ('greenfield', 'nhis', 'gp', 'covered', null, null, 'live', array[2, 6, 11, 20]),
    ('greenfield', 'nhis', 'gp', 'refused', null, null, 'live', array[9, 24]),
    ('labadi', 'nhis', 'gp', 'refused', null, null, 'live', array[6]),
    ('harbourview', 'nhis', 'antenatal', 'refused', null, null, 'live', array[2, 4, 7, 10, 15, 21]),
    ('madina', 'nhis', 'antenatal', 'refused', null, null, 'live', array[5, 9, 13, 19]),
    ('madina', 'nhis', 'gp', 'covered', null, null, 'live', array[11]),
    ('ashaiman', 'nhis', 'gp', 'refused', null, null, 'live', array[12])
  ) as v(code, card, service_id, outcome, amount_ghs, item, state, ages)
  cross join lateral (select public.demo_facility_id(v.code) as id) s
  join public.insurers i on i.slug = v.card
  cross join lateral unnest(v.ages) as d(age);

  -- Hospital replies (rule T) ---------------------------------------------------------------
  insert into public.hospital_responses (facility_id, insurer_id, kind, item, amount_ghs, note, created_at)
  select s.id, i.id, v.kind, v.item, v.amount_ghs, v.note, now() - make_interval(days => v.age)
  from (values
    ('royalpalm', 'cosmopolitan', 'correct_topup', 'drugs', 40::numeric, 'Drugs top-up is GH¢ 40 since this month', 2)
  ) as v(code, card, kind, item, amount_ghs, note, age)
  cross join lateral (select public.demo_facility_id(v.code) as id) s
  join public.insurers i on i.slug = v.card;

  -- Reach: "214 people found you on Veriq last week" for Akoma -------------------------------
  insert into public.reach_daily (facility_id, day, views, search_hits)
  select s.id, current_date - v.days_ago, v.views, v.search_hits
  from (values
    ('akoma', 1, 30, 41), ('akoma', 2, 28, 37), ('akoma', 3, 35, 46), ('akoma', 4, 31, 40),
    ('akoma', 5, 29, 38), ('akoma', 6, 33, 44), ('akoma', 7, 28, 36)
  ) as v(code, days_ago, views, search_hits)
  cross join lateral (select public.demo_facility_id(v.code) as id) s;

  -- Searches, counts only (rule K). area_cell = south-west corner of a 0.02 degree cell (about 2 km),
  -- written as "lat,lng" with two decimals. Ashaiman, Amasaman and Teshie never find a confirmed result.
  insert into public.search_daily (insurer_id, day, area_cell, had_confirmed_result, searches)
  select i.id, current_date - d.day, v.area_cell, v.had_confirmed, v.per_day
  from (values
    ('nhis', '5.54,-0.28', true,  9),   -- Dansoman
    ('nhis', '5.54,-0.28', false, 2),
    ('nhis', '5.62,-0.04', false, 6),   -- Ashaiman
    ('nhis', '5.70,-0.30', false, 4),   -- Amasaman
    ('nhis', '5.54,-0.10', false, 2),   -- Teshie
    ('cosmopolitan', '5.54,-0.28', true, 3),
    (null, '5.54,-0.28', false, 2)      -- "No card/cash" searches
  ) as v(card, area_cell, had_confirmed, per_day)
  left join public.insurers i on i.slug = v.card
  cross join generate_series(0, 29) as d(day);
end
$reset$;
