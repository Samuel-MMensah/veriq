-- Prompt 10: real staff accounts, hospital verification, held-report review and the admin log.
-- Accounts live in Supabase Auth (email and password, made by an admin; nothing is emailed).
-- This migration only adds what the app needs around them. The first admin comes from
-- `npm run create-admin`, never from a migration.

-- Staff profiles --------------------------------------------------------------------
alter table public.profiles
  add column email text,
  add column display_name text,
  -- Set when an admin disables the account; a disabled account can't sign in or write anything.
  add column disabled_at timestamptz,
  -- True after an admin hands over a one-time password; the person must set their own first.
  add column must_change_password boolean not null default true,
  -- Sessions issued before this moment are void (password reset, disabling).
  add column sessions_valid_after timestamptz not null default now(),
  add column created_by uuid references auth.users (id) on delete set null;
create unique index profiles_email_idx on public.profiles (lower(email));

-- Verified hospitals: who verified, and verified needs a time.
alter table public.facilities add column verified_by uuid references auth.users (id) on delete set null;
alter table public.facilities add constraint facilities_verified_has_time check (not verified or verified_at is not null);

-- Held reports (rule A): who released or rejected one, and when.
alter table public.card_reports
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references auth.users (id) on delete set null;

-- Disabled staff lose every power at once (row-level security reads these helpers).
create or replace function public.staff_role() returns text
  language sql stable security definer set search_path = ''
  as $$ select role from public.profiles where user_id = auth.uid() and disabled_at is null $$;

create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = ''
  as $$ select coalesce((select role = 'admin' from public.profiles
                         where user_id = auth.uid() and disabled_at is null), false) $$;

create or replace function public.staff_facility_id() returns uuid
  language sql stable security definer set search_path = ''
  as $$ select facility_id from public.profiles
        where user_id = auth.uid() and role = 'hospital' and disabled_at is null $$;

create or replace function public.staff_insurer_id() returns uuid
  language sql stable security definer set search_path = ''
  as $$ select insurer_id from public.profiles
        where user_id = auth.uid() and role = 'insurer' and disabled_at is null $$;

-- Only a verified hospital's staff publish a morning check or hospital answers.
create function public.staff_verified_facility_id() returns uuid
  language sql stable security definer set search_path = ''
  as $$ select p.facility_id from public.profiles p
        join public.facilities f on f.id = p.facility_id
        where p.user_id = auth.uid() and p.role = 'hospital' and p.disabled_at is null and f.verified $$;

drop policy "hospital adds own status" on public.status_updates;
create policy "verified hospital adds own status" on public.status_updates for insert to authenticated
  with check (facility_id = public.staff_verified_facility_id() and source = 'hospital' and created_by = auth.uid());

drop policy "hospital adds own insurer links" on public.facility_insurers;
create policy "verified hospital adds own insurer links" on public.facility_insurers for insert to authenticated
  with check (facility_id = public.staff_verified_facility_id() and listed_by = 'none');

drop policy "hospital updates own insurer links" on public.facility_insurers;
create policy "verified hospital updates own insurer links" on public.facility_insurers for update to authenticated
  using (facility_id = public.staff_verified_facility_id()) with check (facility_id = public.staff_verified_facility_id());

drop policy "hospital adds own responses" on public.hospital_responses;
create policy "verified hospital adds own responses" on public.hospital_responses for insert to authenticated
  with check (facility_id = public.staff_verified_facility_id() and created_by = auth.uid());

-- The admin log: who did what, when and why. Append-only, for everyone, the service role included.
-- No foreign keys, so the history outlives the rows it is about (e.g. a demo reset).
create table public.admin_actions (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid,
  -- The admin's email at the time, "Demo admin" or "create-admin script".
  actor_label  text not null,
  action       text not null check (action in (
                 'create_account', 'disable_account', 'enable_account', 'reset_password', 'link_account',
                 'verify_hospital', 'unverify_hospital', 'release_report', 'reject_report', 'set_location')),
  facility_id  uuid,
  profile_id   uuid,
  report_id    uuid,
  reason       text,
  details      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index admin_actions_facility_idx on public.admin_actions (facility_id, created_at desc);
create index admin_actions_profile_idx on public.admin_actions (profile_id, created_at desc);
create index admin_actions_time_idx on public.admin_actions (created_at desc);

create function public.admin_actions_append_only() returns trigger
  language plpgsql set search_path = ''
  as $$ begin raise exception 'admin_actions is append-only'; end $$;
create trigger admin_actions_no_change before update or delete on public.admin_actions
  for each row execute function public.admin_actions_append_only();
create trigger admin_actions_no_truncate before truncate on public.admin_actions
  for each statement execute function public.admin_actions_append_only();

alter table public.admin_actions enable row level security;
create policy "admin reads the log" on public.admin_actions for select to authenticated using (public.is_admin());
create policy "admin adds to the log" on public.admin_actions for insert to authenticated
  with check (public.is_admin() and actor_id = auth.uid());
