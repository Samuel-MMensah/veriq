-- Prompt 9: real facilities from the NHIA list beside the demo ones (SPEC section 3, rules 1, D1–D3, F).
-- Real rows carry only what their source file says (rule D1), so ownership type, area and location
-- may be unknown. Demo rows keep every column filled, as before.

alter table public.facilities
  alter column type drop not null,
  alter column area drop not null,
  alter column lat drop not null,
  alter column lng drop not null;

alter table public.facilities
  -- Existing rows are the invented demo hospitals (rule 1).
  add column source text not null default 'demo' check (source in ('nhia', 'demo')),
  -- The row or code in the source file.
  add column source_ref text,
  -- The month the list was taken, for "From the NHIA list, October 2026" (rule D1).
  add column source_date date,
  -- The facility type as the file writes it, e.g. "PRIMARY HOSPITAL".
  add column nhia_type text,
  -- Where lat/lng came from. Demo rows were placed by the team, so "admin".
  add column location_source text not null default 'admin' check (location_source in ('osm', 'admin', 'none')),
  add column location_checked_at timestamptz;

alter table public.facilities
  -- Rule D1: no location means no coordinates, and the other way round.
  add constraint facilities_location_known check ((location_source = 'none') = (lat is null) and (lat is null) = (lng is null)),
  -- Rule 1: demo and sample are the same thing; real rows always name their source row.
  add constraint facilities_demo_is_sample check ((source = 'demo') = is_sample),
  add constraint facilities_real_has_ref check (source = 'demo' or (source_ref is not null and source_date is not null)),
  -- Demo rows still have every fact the demo shows.
  add constraint facilities_demo_complete check (source <> 'demo' or (type is not null and area is not null and lat is not null));

create unique index facilities_source_ref_idx on public.facilities (source, source_ref) where source_ref is not null;
create index facilities_source_idx on public.facilities (source);

-- Rule F: a status may say until when it holds ("open till 4 pm").
alter table public.status_updates add column until_time time;

create or replace view public.current_status with (security_invoker = true) as
  select distinct on (facility_id, service_id)
    id, facility_id, service_id, status, from_time, note, source, created_at, until_time
  from public.status_updates
  order by facility_id, service_id, created_at desc;

-- The demo seed: the same story, with Akoma's "Open till 4 pm" as an until_time instead of free
-- text, so it stops counting once 4 pm has passed (rule F). From 3 pm on, the till time is two
-- hours ahead, so the demo reads the same at any time of day.
alter function public.reset_demo() rename to reset_demo_story;
revoke all on function public.reset_demo_story() from public, anon, authenticated;

create function public.reset_demo() returns void
  language plpgsql security definer set search_path = public
  as $reset$
begin
  perform public.reset_demo_story();
  update public.status_updates
  set note = null,
      until_time = case
        when (now() at time zone 'Africa/Accra')::time < time '15:00' then time '16:00'
        else date_trunc('hour', (now() at time zone 'Africa/Accra') + interval '2 hours')::time
      end
  where facility_id = public.demo_facility_id('akoma')
    and service_id = 'antenatal'
    and note = 'Open till 4 pm';
end
$reset$;
revoke all on function public.reset_demo() from public, anon, authenticated;
grant execute on function public.reset_demo() to service_role;
