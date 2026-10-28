-- Rules 1 and D2 for cards: Sika Health and Adom Care are invented insurers from the demo seed. They
-- are demo-only, like the demo hospitals: never on the real site, in a real call, in the call form or
-- in the call summary. This marks them, and the database refuses to tie them to anything real.

alter table public.insurers add column is_sample boolean not null default false;

-- The two invented insurers, by the fixed ids reset_demo() uses. A trigger keeps them marked even if
-- "Reset demo data" inserts them again (its upsert never sets is_sample).
create function public.insurers_mark_demo() returns trigger
  language plpgsql set search_path = ''
  as $$
begin
  if new.id in ('a0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000005') then
    new.is_sample := true;
  end if;
  return new;
end
$$;
create trigger insurers_mark_demo before insert or update on public.insurers
  for each row execute function public.insurers_mark_demo();
update public.insurers set is_sample = true
where id in ('a0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000005');

create function public.is_demo_insurer(p_insurer uuid) returns boolean
  language sql stable security definer set search_path = ''
  as $$ select coalesce((select is_sample from public.insurers where id = p_insurer), false) $$;

create function public.is_real_facility(p_facility uuid) returns boolean
  language sql stable security definer set search_path = ''
  as $$ select coalesce((select source <> 'demo' from public.facilities where id = p_facility), false) $$;

-- A demo card never sits on a real facility: no list row, no call answer, no report, no reply.
create function public.demo_insurer_demo_only() returns trigger
  language plpgsql set search_path = ''
  as $$
declare
  fid uuid;
begin
  if not public.is_demo_insurer(new.insurer_id) then return new; end if;
  if tg_table_name = 'verification_call_answers' then
    -- Calls are for real facilities only, so a demo card can never be in one.
    raise exception 'demo insurers are never asked about on a real call';
  end if;
  fid := new.facility_id;
  if public.is_real_facility(fid) then
    raise exception 'demo insurers are for demo facilities only';
  end if;
  return new;
end
$$;
create trigger facility_insurers_demo_only before insert or update on public.facility_insurers
  for each row execute function public.demo_insurer_demo_only();
create trigger card_reports_demo_only before insert or update on public.card_reports
  for each row execute function public.demo_insurer_demo_only();
create trigger hospital_responses_demo_only before insert or update on public.hospital_responses
  for each row execute function public.demo_insurer_demo_only();
create trigger verification_call_answers_demo_only before insert on public.verification_call_answers
  for each row execute function public.demo_insurer_demo_only();

-- No real staff account is linked to a demo insurer (the demo login uses NHIS and never has a profile).
create function public.profiles_no_demo_insurer() returns trigger
  language plpgsql set search_path = ''
  as $$
begin
  if new.insurer_id is not null and public.is_demo_insurer(new.insurer_id) then
    raise exception 'staff accounts are never linked to a demo insurer';
  end if;
  return new;
end
$$;
create trigger profiles_no_demo_insurer before insert or update on public.profiles
  for each row execute function public.profiles_no_demo_insurer();

-- The two helpers stay callable by every role: the triggers above run as whoever writes the row
-- (a hospital's staff, the report route), and they reveal nothing that isn't already public.
