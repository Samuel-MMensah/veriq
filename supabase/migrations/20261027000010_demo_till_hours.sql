-- Demo data only (rule 1). The demo till time reads like a real clinic at any hour (rule F):
-- reset + 4 hours to the nearest hour, never earlier than 12:00 or later than 20:00 Accra time,
-- and a reset at or after 19:00 gives plain "Open" with no till time. Migration 9 gave "Open till
-- 1 am" after a 21:23 reset. Same rule as demoUntilTime() in lib/rules/demo-time.ts; a database
-- test checks the two agree. Applies to every demo till time (today only Akoma's antenatal clinic).

create function public.demo_until_time(reset_at timestamptz) returns time
  language sql immutable set search_path = ''
  as $$
    select case
      when extract(hour from reset_at at time zone 'Africa/Accra') >= 19 then null
      else make_time(
        least(20, greatest(12,
          case
            -- reset + 4.5 h past midnight only happens above 20:00, so it clamps to 20:00
            when (reset_at at time zone 'Africa/Accra' + interval '4 hours 30 minutes')::date
                 > (reset_at at time zone 'Africa/Accra')::date then 24
            else extract(hour from reset_at at time zone 'Africa/Accra' + interval '4 hours 30 minutes')::int
          end
        )), 0, 0)
    end
  $$;

create or replace function public.reset_demo() returns void
  language plpgsql security definer set search_path = public
  as $reset$
declare
  cosmo constant uuid := 'a0000000-0000-4000-8000-000000000002';
  till constant time := public.demo_until_time(now());
begin
  perform public.reset_demo_story();

  -- Rule F: Akoma's antenatal "Open till 4 pm" becomes the demo till time; null means plain "Open".
  update public.status_updates
  set note = null, until_time = till
  where facility_id = public.demo_facility_id('akoma')
    and service_id = 'antenatal'
    and note = 'Open till 4 pm';

  -- Any other demo till time follows the same rule (demo facilities only).
  update public.status_updates s
  set until_time = till
  from public.facilities f
  where f.id = s.facility_id and f.source = 'demo' and s.until_time is not null;

  -- Cosmopolitan Health: Gbawe and Glefe are on the insurer's list (rules B4 and B1). (As migration 9.)
  insert into public.facility_insurers (facility_id, insurer_id, listed_by)
  values (public.demo_facility_id('gbawe'), cosmo, 'insurer'),
         (public.demo_facility_id('glefe'), cosmo, 'insurer');

  -- Lakeside: 5 members say the card worked (rule B3). Glefe: 4 members refused (rule B1). (As migration 9.)
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

-- Apply it now, so the live demo data follows the new rule without waiting for a reset.
select public.reset_demo();
