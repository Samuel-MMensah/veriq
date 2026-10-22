-- Veriq Health schema, Phase 1 (SPEC section 3).
-- Badges and sorting are computed in code (lib/rules), never stored here (rule 6).
-- No table holds a patient name, card number or IP address (rule 2).

-- Facilities -----------------------------------------------------------------
create table public.facilities (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  type         text not null check (type in ('public', 'mission', 'private', 'quasi')),
  region       text not null,
  district     text not null,
  area         text not null,
  lat          double precision not null check (lat between -90 and 90),
  lng          double precision not null check (lng between -180 and 180),
  phone        text,
  verified     boolean not null default false,
  verified_at  timestamptz,
  nhia_listed  boolean not null default false,
  -- Rule 1: sample data only until Phase 2, so new rows are sample unless said otherwise.
  is_sample    boolean not null default true,
  created_at   timestamptz not null default now()
);
create index facilities_lat_lng_idx on public.facilities (lat, lng);

-- Services -------------------------------------------------------------------
create table public.services (
  id          text primary key check (id ~ '^[a-z_]+$'),
  name        text not null,
  category    text not null,
  created_at  timestamptz not null default now()
);

create table public.facility_services (
  facility_id  uuid not null references public.facilities (id) on delete cascade,
  service_id   text not null references public.services (id) on delete cascade,
  offered      boolean not null default true,
  usual_hours  text,
  created_at   timestamptz not null default now(),
  primary key (facility_id, service_id)
);
create index facility_services_service_idx on public.facility_services (service_id) where offered;

-- Status updates: append-only. Current status = newest row per facility and service (rule F).
create table public.status_updates (
  id           uuid primary key default gen_random_uuid(),
  facility_id  uuid not null references public.facilities (id) on delete cascade,
  service_id   text not null references public.services (id) on delete cascade,
  status       text not null check (status in ('open', 'closed', 'accepting', 'full', 'working', 'down', 'from_time')),
  from_time    time,
  note         text,
  source       text not null check (source in ('hospital', 'admin')),
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  check (status <> 'from_time' or from_time is not null)
);
create index status_updates_latest_idx on public.status_updates (facility_id, service_id, created_at desc);

create view public.current_status with (security_invoker = true) as
  select distinct on (facility_id, service_id)
    id, facility_id, service_id, status, from_time, note, source, created_at
  from public.status_updates
  order by facility_id, service_id, created_at desc;

-- Insurers -------------------------------------------------------------------
create table public.insurers (
  id          uuid primary key default gen_random_uuid(),
  -- Short id used in URLs, e.g. /results?card=nhis.
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name        text not null unique,
  kind        text not null check (kind in ('public', 'private')),
  created_at  timestamptz not null default now()
);

-- One row per facility and insurer: the lists and the hospital's own answer (rule B).
create table public.facility_insurers (
  facility_id            uuid not null references public.facilities (id) on delete cascade,
  insurer_id             uuid not null references public.insurers (id) on delete cascade,
  listed_by              text not null default 'none' check (listed_by in ('nhia', 'insurer', 'none')),
  hospital_says          text check (hospital_says in ('accepts', 'does_not', 'partial')),
  hospital_confirmed_at  timestamptz,
  created_at             timestamptz not null default now(),
  primary key (facility_id, insurer_id)
);
create index facility_insurers_insurer_idx on public.facility_insurers (insurer_id);

-- Patient reports. Only a device hash, never identity (rule 2). Inserted only via /api/reports (rule A).
create table public.card_reports (
  id           uuid primary key default gen_random_uuid(),
  facility_id  uuid not null references public.facilities (id) on delete cascade,
  insurer_id   uuid not null references public.insurers (id) on delete cascade,
  service_id   text references public.services (id) on delete set null,
  outcome      text not null check (outcome in ('covered', 'topup', 'refused')),
  amount_ghs   numeric(10, 2) check (amount_ghs is null or amount_ghs >= 0),
  item         text check (item in ('scan', 'drugs', 'lab', 'registration')),
  device_hash  text not null,
  state        text not null default 'live' check (state in ('live', 'held', 'rejected')),
  created_at   timestamptz not null default now()
);
create index card_reports_pair_idx on public.card_reports (facility_id, insurer_id, created_at desc);
create index card_reports_device_idx on public.card_reports (device_hash, facility_id, created_at desc);
create index card_reports_insurer_idx on public.card_reports (insurer_id, created_at desc);

-- Hospital replies shown beside patient reports (rule T).
create table public.hospital_responses (
  id           uuid primary key default gen_random_uuid(),
  facility_id  uuid not null references public.facilities (id) on delete cascade,
  insurer_id   uuid not null references public.insurers (id) on delete cascade,
  kind         text not null check (kind in ('confirm_topup', 'correct_topup', 'dispute_refusals')),
  -- Rule T is per item, so a top-up reply names the item it is about.
  item         text check (item in ('scan', 'drugs', 'lab', 'registration')),
  amount_ghs   numeric(10, 2) check (amount_ghs is null or amount_ghs >= 0),
  note         text,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index hospital_responses_pair_idx on public.hospital_responses (facility_id, insurer_id, created_at desc);

-- Staff only. Patients have no profile (rule 2).
create table public.profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  role         text not null check (role in ('hospital', 'insurer', 'admin')),
  facility_id  uuid references public.facilities (id) on delete set null,
  insurer_id   uuid references public.insurers (id) on delete set null,
  phone        text,
  created_at   timestamptz not null default now(),
  check (role <> 'hospital' or facility_id is not null),
  check (role <> 'insurer' or insurer_id is not null)
);

-- Counts only, for "people found you".
create table public.reach_daily (
  facility_id  uuid not null references public.facilities (id) on delete cascade,
  day          date not null,
  views        integer not null default 0 check (views >= 0),
  search_hits  integer not null default 0 check (search_hits >= 0),
  created_at   timestamptz not null default now(),
  primary key (facility_id, day)
);

-- Counts only, for rule K (member searches and coverage gaps). insurer_id is null for "No card/cash".
create table public.search_daily (
  id                    uuid primary key default gen_random_uuid(),
  insurer_id            uuid references public.insurers (id) on delete cascade,
  day                   date not null,
  area_cell             text not null,
  had_confirmed_result  boolean not null,
  searches              integer not null default 0 check (searches >= 0),
  created_at            timestamptz not null default now(),
  unique nulls not distinct (insurer_id, day, area_cell, had_confirmed_result)
);
create index search_daily_insurer_day_idx on public.search_daily (insurer_id, day);
