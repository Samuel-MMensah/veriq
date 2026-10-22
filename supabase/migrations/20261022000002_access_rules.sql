-- Access rules (SPEC section 3, "Access rules").
-- Anyone reads facilities, services, current status, insurer links and live report counts.
-- Reports are inserted only by /api/reports with the service role, which applies rule A.
-- Hospital staff write only their own facility's rows. Insurer staff read only their own insurer's aggregates.
-- Admin can do everything. The service role bypasses row-level security.

-- Staff helpers. Security definer so policies can read profiles without recursion.
create function public.staff_role() returns text
  language sql stable security definer set search_path = ''
  as $$ select role from public.profiles where user_id = auth.uid() $$;

create function public.is_admin() returns boolean
  language sql stable security definer set search_path = ''
  as $$ select coalesce((select role = 'admin' from public.profiles where user_id = auth.uid()), false) $$;

create function public.staff_facility_id() returns uuid
  language sql stable security definer set search_path = ''
  as $$ select facility_id from public.profiles where user_id = auth.uid() and role = 'hospital' $$;

create function public.staff_insurer_id() returns uuid
  language sql stable security definer set search_path = ''
  as $$ select insurer_id from public.profiles where user_id = auth.uid() and role = 'insurer' $$;

alter table public.facilities         enable row level security;
alter table public.services           enable row level security;
alter table public.facility_services  enable row level security;
alter table public.status_updates     enable row level security;
alter table public.insurers           enable row level security;
alter table public.facility_insurers  enable row level security;
alter table public.card_reports       enable row level security;
alter table public.hospital_responses enable row level security;
alter table public.profiles           enable row level security;
alter table public.reach_daily        enable row level security;
alter table public.search_daily       enable row level security;

-- Public reads -----------------------------------------------------------------
create policy "anyone reads facilities" on public.facilities for select to anon, authenticated using (true);
create policy "anyone reads services" on public.services for select to anon, authenticated using (true);
create policy "anyone reads facility services" on public.facility_services for select to anon, authenticated using (true);
create policy "anyone reads status" on public.status_updates for select to anon, authenticated using (true);
create policy "anyone reads insurers" on public.insurers for select to anon, authenticated using (true);
create policy "anyone reads insurer links" on public.facility_insurers for select to anon, authenticated using (true);
create policy "anyone reads hospital responses" on public.hospital_responses for select to anon, authenticated using (true);

-- Live reports without device hashes. card_reports itself has no public read policy;
-- this view (owned by the migration role) exposes only live rows and safe columns.
-- Held and rejected reports never count (rule A).
create view public.public_card_reports as
  select id, facility_id, insurer_id, service_id, outcome, amount_ghs, item, created_at
  from public.card_reports
  where state = 'live';
revoke all on public.public_card_reports from anon, authenticated;
grant select on public.public_card_reports to anon, authenticated;

-- Hospital staff: own facility only --------------------------------------------
create policy "hospital writes own services" on public.facility_services for insert to authenticated
  with check (facility_id = public.staff_facility_id());
create policy "hospital updates own services" on public.facility_services for update to authenticated
  using (facility_id = public.staff_facility_id()) with check (facility_id = public.staff_facility_id());

-- Rule M: publishing writes one status row per changed service. Append-only, so no update policy.
create policy "hospital adds own status" on public.status_updates for insert to authenticated
  with check (facility_id = public.staff_facility_id() and source = 'hospital' and created_by = auth.uid());

-- Rule M: hospitals set their own answer and hospital_confirmed_at; only admin changes listed_by.
create policy "hospital adds own insurer links" on public.facility_insurers for insert to authenticated
  with check (facility_id = public.staff_facility_id() and listed_by = 'none');
create policy "hospital updates own insurer links" on public.facility_insurers for update to authenticated
  using (facility_id = public.staff_facility_id()) with check (facility_id = public.staff_facility_id());

create function public.guard_listed_by() returns trigger
  language plpgsql set search_path = ''
  as $$
  begin
    if new.listed_by is distinct from old.listed_by
       and current_user in ('anon', 'authenticated')
       and not public.is_admin() then
      raise exception 'Only admin can change which list a hospital is on';
    end if;
    return new;
  end $$;
create trigger facility_insurers_guard_listed_by before update on public.facility_insurers
  for each row execute function public.guard_listed_by();

create policy "hospital adds own responses" on public.hospital_responses for insert to authenticated
  with check (facility_id = public.staff_facility_id() and created_by = auth.uid());

create policy "hospital reads own reach" on public.reach_daily for select to authenticated
  using (facility_id = public.staff_facility_id());

-- Insurer staff: own insurer aggregates only (rule K) ----------------------------
create policy "insurer reads own searches" on public.search_daily for select to authenticated
  using (insurer_id = public.staff_insurer_id());

-- Profiles ---------------------------------------------------------------------
create policy "staff read own profile" on public.profiles for select to authenticated
  using (user_id = auth.uid());

-- Admin: everything --------------------------------------------------------------
create policy "admin all facilities" on public.facilities for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin all services" on public.services for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin all facility services" on public.facility_services for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin all status" on public.status_updates for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin all insurers" on public.insurers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin all insurer links" on public.facility_insurers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin all reports" on public.card_reports for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin all responses" on public.hospital_responses for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin all profiles" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin all reach" on public.reach_daily for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin all searches" on public.search_daily for all to authenticated using (public.is_admin()) with check (public.is_admin());
