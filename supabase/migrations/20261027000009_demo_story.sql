-- Pitch-ready fix-up (2026-10-27), demo data only (rule 1: every row here is on a demo facility).
-- 1. Rule F till times: "Reset demo data" sets Akoma's antenatal "open till" to the reset time plus
--    4 hours, rounded to the hour, so it never reads "Was open till …" during a pitch that follows a
--    reset. (Migration 6 used 4 pm, which had passed by an afternoon pitch.)
-- 2. A private card tells the same story as NHIS: Cosmopolitan Health near Dansoman (antenatal,
--    5 km) shows hospital confirmed (Akoma, Pinecrest, Royal Palm), patients confirmed (Lakeside),
--    on the insurer's list but not checked (Gbawe), and members reporting refusals (Glefe).
-- The NHIS story (SPEC section 9) is unchanged.

create or replace function public.reset_demo() returns void
  language plpgsql security definer set search_path = public
  as $reset$
declare
  cosmo constant uuid := 'a0000000-0000-4000-8000-000000000002';
begin
  perform public.reset_demo_story();

  -- Rule F: open till the reset time + 4 hours, to the nearest hour (Accra time is UTC).
  update public.status_updates
  set note = null,
      until_time = date_trunc('hour', (now() at time zone 'Africa/Accra') + interval '4 hours 30 minutes')::time
  where facility_id = public.demo_facility_id('akoma')
    and service_id = 'antenatal'
    and note = 'Open till 4 pm';

  -- Cosmopolitan Health: Gbawe and Glefe are on the insurer's list (rules B4 and B1).
  insert into public.facility_insurers (facility_id, insurer_id, listed_by)
  values (public.demo_facility_id('gbawe'), cosmo, 'insurer'),
         (public.demo_facility_id('glefe'), cosmo, 'insurer');

  -- Lakeside: 5 members say the card worked in the last 30 days (rule B3).
  -- Glefe: 4 members refused in the last 30 days, none accepted (rule B1).
  insert into public.card_reports (facility_id, insurer_id, service_id, outcome, device_hash, state, created_at)
  select public.demo_facility_id(v.code), cosmo, 'antenatal', v.outcome,
         encode(sha256(convert_to('seed:' || gen_random_uuid()::text, 'UTF8')), 'hex'),
         'live', now() - make_interval(days => d.age) - interval '2 hours'
  from (values
    ('lakeside', 'covered', array[2, 5, 9, 14, 20]),
    ('glefe',    'refused', array[1, 3, 6, 9])
  ) as v(code, outcome, ages)
  cross join lateral unnest(v.ages) as d(age);
end
$reset$;
revoke all on function public.reset_demo() from public, anon, authenticated;
grant execute on function public.reset_demo() to service_role;

-- Apply it now, so the live demo data matches without waiting for a reset.
select public.reset_demo();
