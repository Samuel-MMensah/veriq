-- Prompt 10b: verification calls by the Veriq team (SPEC section 3, rule B-V). A team member calls a
-- real facility and records what it says about each card, its phone number, services, usual hours
-- and, optionally, its map location. No patient data is involved (rule 2).
-- Every call fact keeps its source ("veriq_call") and time (rule 4).

-- The call itself: append-only, like the admin log, so the pitch figures can't drift. ------------
create table public.verification_calls (
  id             uuid primary key default gen_random_uuid(),
  facility_id    uuid not null references public.facilities (id),
  called_at      timestamptz not null,
  -- The staff account that called (null when that account was later removed), and its email then.
  called_by      uuid references auth.users (id) on delete set null,
  caller_label   text not null check (length(caller_label) between 1 and 200),
  -- A role only, never a name, e.g. "front desk".
  answered_role  text not null check (length(answered_role) between 1 and 60),
  phone_reached  text not null check (phone_reached ~ '^\+?[0-9]{9,13}$'),
  services       text[] not null default '{}',
  usual_hours    text check (usual_hours is null or length(usual_hours) <= 80),
  lat            double precision check (lat between -90 and 90),
  lng            double precision check (lng between -180 and 180),
  -- "form" or "csv" (a paper call typed in later).
  entered_via    text not null default 'form' check (entered_via in ('form', 'csv')),
  created_at     timestamptz not null default now(),
  check ((lat is null) = (lng is null)),
  -- One call per facility per moment: importing the same paper sheet twice changes nothing.
  unique (facility_id, called_at)
);
create index verification_calls_time_idx on public.verification_calls (called_at desc);

-- What the facility said about each card: one row per card asked about, "not_asked" included.
create table public.verification_call_answers (
  call_id     uuid not null references public.verification_calls (id),
  insurer_id  uuid not null references public.insurers (id),
  answer      text not null check (answer in ('accepts', 'does_not', 'partial', 'not_asked')),
  note        text check (note is null or length(note) <= 120),
  created_at  timestamptz not null default now(),
  primary key (call_id, insurer_id),
  -- "partial" needs its short note, e.g. "top-up for scans".
  check (answer <> 'partial' or (note is not null and length(trim(note)) > 0))
);
create index verification_call_answers_insurer_idx on public.verification_call_answers (insurer_id);

-- Real facilities only: a call is never recorded against an invented demo hospital (rule D2).
create function public.verification_calls_real_only() returns trigger
  language plpgsql set search_path = ''
  as $$
begin
  if not exists (select 1 from public.facilities where id = new.facility_id and source <> 'demo') then
    raise exception 'verification calls are for real facilities only';
  end if;
  return new;
end
$$;
create trigger verification_calls_real_only before insert on public.verification_calls
  for each row execute function public.verification_calls_real_only();

create function public.verification_calls_append_only() returns trigger
  language plpgsql set search_path = ''
  as $$ begin raise exception 'verification calls are append-only'; end $$;
create trigger verification_calls_no_change before update or delete on public.verification_calls
  for each row execute function public.verification_calls_append_only();
create trigger verification_calls_no_truncate before truncate on public.verification_calls
  for each statement execute function public.verification_calls_append_only();
create trigger verification_call_answers_no_change before update or delete on public.verification_call_answers
  for each row execute function public.verification_calls_append_only();
create trigger verification_call_answers_no_truncate before truncate on public.verification_call_answers
  for each statement execute function public.verification_calls_append_only();

alter table public.verification_calls enable row level security;
alter table public.verification_call_answers enable row level security;
create policy "admin reads calls" on public.verification_calls for select to authenticated using (public.is_admin());
create policy "admin reads call answers" on public.verification_call_answers for select to authenticated using (public.is_admin());
-- Writes go through record_verification_call() (service role) only.

-- Call facts on the facility, each with its source and time (rule 4). ---------------------------
alter table public.facilities
  -- Where the phone number came from: the source file, or a Veriq call that reached it.
  add column phone_source text check (phone_source in ('nhia', 'veriq_call')),
  add column phone_checked_at timestamptz,
  add constraint facilities_phone_sourced check (source = 'demo' or phone is null or phone_source is not null);

alter table public.facility_services
  -- Who said the facility offers it: null for the demo seed, "veriq_call" for a Veriq call.
  add column source text check (source in ('hospital', 'admin', 'veriq_call')),
  add column checked_at timestamptz;

-- Rule B-V: the newest Veriq call's answer for this card, beside the lists and the hospital's own answer.
alter table public.facility_insurers
  add column call_says text check (call_says in ('accepts', 'does_not', 'partial')),
  add column call_at timestamptz,
  add column call_note text,
  add constraint facility_insurers_call_dated check ((call_says is null) = (call_at is null));

-- The admin log names a recorded call.
alter table public.admin_actions drop constraint admin_actions_action_check;
alter table public.admin_actions add constraint admin_actions_action_check check (action in (
  'create_account', 'disable_account', 'enable_account', 'reset_password', 'link_account',
  'verify_hospital', 'unverify_hospital', 'release_report', 'reject_report', 'set_location', 'record_call'));

-- Record one call, all or nothing. The app checks the input first (lib/calls/record.ts); this keeps
-- the tables consistent. A call never overwrites a newer fact: an older paper call typed in later
-- adds to the history only.
create function public.record_verification_call(p jsonb) returns uuid
  language plpgsql security definer set search_path = public
  as $rec$
declare
  new_call uuid;
  call_time timestamptz := (p ->> 'called_at')::timestamptz;
  fid uuid := (p ->> 'facility_id')::uuid;
  a jsonb;
  s text;
begin
  insert into verification_calls (facility_id, called_at, called_by, caller_label, answered_role, phone_reached,
                                  services, usual_hours, lat, lng, entered_via)
  values (fid, call_time, nullif(p ->> 'called_by', '')::uuid, p ->> 'caller_label', p ->> 'answered_role', p ->> 'phone_reached',
          coalesce(array(select jsonb_array_elements_text(p -> 'services')), '{}'), nullif(p ->> 'usual_hours', ''),
          (p ->> 'lat')::double precision, (p ->> 'lng')::double precision, coalesce(p ->> 'entered_via', 'form'))
  returning id into new_call;

  for a in select * from jsonb_array_elements(coalesce(p -> 'answers', '[]'::jsonb)) loop
    insert into verification_call_answers (call_id, insurer_id, answer, note)
    values (new_call, (a ->> 'insurer_id')::uuid, a ->> 'answer', nullif(trim(a ->> 'note'), ''));
    -- rule B-V: the card's newest call answer. "Not asked" changes nothing.
    if a ->> 'answer' <> 'not_asked' then
      insert into facility_insurers (facility_id, insurer_id, listed_by, call_says, call_at, call_note)
      values (fid, (a ->> 'insurer_id')::uuid, 'none', a ->> 'answer', call_time, nullif(trim(a ->> 'note'), ''))
      on conflict (facility_id, insurer_id) do update
        set call_says = excluded.call_says, call_at = excluded.call_at, call_note = excluded.call_note
        where facility_insurers.call_at is null or facility_insurers.call_at <= excluded.call_at;
    end if;
  end loop;

  -- The number reached, so patients can call it.
  update facilities set phone = p ->> 'phone_reached', phone_source = 'veriq_call', phone_checked_at = call_time
  where id = fid and (phone_checked_at is null or phone_checked_at <= call_time);

  for s in select jsonb_array_elements_text(coalesce(p -> 'services', '[]'::jsonb)) loop
    insert into facility_services (facility_id, service_id, offered, usual_hours, source, checked_at)
    values (fid, s, true, nullif(p ->> 'usual_hours', ''), 'veriq_call', call_time)
    on conflict (facility_id, service_id) do update
      set offered = true, usual_hours = coalesce(excluded.usual_hours, facility_services.usual_hours),
          source = 'veriq_call', checked_at = excluded.checked_at
      where facility_services.checked_at is null or facility_services.checked_at <= excluded.checked_at;
  end loop;

  -- The "Needs a location" tool's rule D1: a typed point is location_source = admin.
  if p ? 'lat' and p ->> 'lat' is not null then
    update facilities set lat = (p ->> 'lat')::double precision, lng = (p ->> 'lng')::double precision,
                          location_source = 'admin', location_checked_at = call_time
    where id = fid and (location_checked_at is null or location_checked_at <= call_time);
  end if;

  insert into admin_actions (actor_id, actor_label, action, facility_id, details)
  values (nullif(p ->> 'actor_id', '')::uuid, p ->> 'actor_label', 'record_call', fid,
          jsonb_build_object('call_id', new_call, 'called_at', call_time, 'entered_via', coalesce(p ->> 'entered_via', 'form')));
  return new_call;
end
$rec$;
revoke all on function public.record_verification_call(jsonb) from public, anon, authenticated;
grant execute on function public.record_verification_call(jsonb) to service_role;
