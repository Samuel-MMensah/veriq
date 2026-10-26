# Deploying Veriq Health (Phase 1 pitch demo)

Vercel, from GitHub. The database is the Supabase project already set up (migrations 1–5 applied; 6 and 7 come with Prompt 9, see "Applying new migrations" below).

## 1. Push the code

Commit and push `main` to GitHub (`origin`). `.env.local` is git-ignored and must never be pushed.

## 2. Import into Vercel

1. vercel.com → Add New → Project → import the `veriq` repository.
2. Framework preset: Next.js (detected). Leave the build and install commands as they are.
3. Before the first deploy, open **Environment Variables** and add the six below for **Production** (and Preview if you use preview links). Copy each value from `.env.local` on this computer.

| Name | What it is | Mark as sensitive |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | no |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon / publishable key | no |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role / secret key (server only) | yes |
| `REPORT_HASH_SECRET` | Mixed into report device hashes (rule A) | yes |
| `SESSION_SECRET` | Signs the staff demo-login cookie | yes |
| `CRON_SECRET` | Vercel Cron sends it to the 07:30 reminder (rule M) | yes |

Do **not** add:
- `SUPABASE_DB_URL`: it's only for pushing migrations from this computer.
- `VERIQ_DATA`: setting it to `local` would make the site use throwaway in-memory data.
- `DEMO_LOGIN`: leave it unset for the pitch (demo login on). Set `DEMO_LOGIN=off` on any deploy that isn't a demo.

4. Deploy. `vercel.json` runs the functions in Dublin (`dub1`, next to Supabase in eu-west-1) and schedules the reminder at 07:30 Ghana time.

## 3. After the first deploy

1. Open `https://<your-domain>/admin/demo`, tap Demo login, then **Reset demo data**.
2. Run the checks against the live site from this computer:
   ```powershell
   $env:E2E_BASE_URL="https://<your-domain>"; npx playwright test perf demo
   ```
   The demo test resets the demo first and leaves Akoma's antenatal clinic closed (step 6), so reset again afterwards.
3. Rehearse the demo by hand on a mid-range Android phone (Phase 1 gate).

## Before every pitch

`/admin/demo` → Reset demo data (fresh times, the demo story), and "Make this phone fresh" on the presenting phone.

## Applying new migrations (Prompt 9: migrations 6 and 7)

Database first, then the code: the new code reads columns that migration 6 adds.

1. Check what will run (nothing changes yet):
   ```powershell
   npx supabase db push --db-url "<SUPABASE_DB_URL from .env.local>" --dry-run
   ```
   It should list exactly `20261026000006_directory.sql` and `20261026000007_nhia_greater_accra.sql`.
2. Apply them: the same command without `--dry-run`.
3. In the Supabase SQL editor, check the result:
   ```sql
   select source, count(*), count(*) filter (where location_source = 'osm') as located
   from public.facilities group by source;               -- demo 18 / 18; nhia 417 / 57
   select count(*) from public.status_updates s join public.facilities f on f.id = s.facility_id
   where f.source = 'nhia';                              -- 0 (rule D2)
   ```
4. Re-run the demo seed so Akoma's "Open till 4 pm" becomes an until_time (rule F):
   `select public.reset_demo();` in the SQL editor, or /admin/demo → Reset demo data after the deploy.
5. Vercel: leave `REPORTS_LIVE` **unset** (reports on real hospitals stay closed, rule R1). Set it to `on` only after the Data Protection Commission registration.
6. Push the code; after Vercel deploys, run the live checks:
   ```powershell
   $env:E2E_BASE_URL="https://veriqhealth.vercel.app"; npx playwright test directory demo
   ```
   (`directory.spec.ts` skips its /admin test on the live site, because that test saves a location.)

To roll back migration 7's rows only: `delete from public.facilities where source = 'nhia';` (their NHIS rows go with them).
