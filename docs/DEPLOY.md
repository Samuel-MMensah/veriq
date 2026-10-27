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

## Prompt 10: real staff sign-in (migration 8)

Database first, then the code: the new code reads columns that migration 8 adds.

1. **Supabase dashboard, Authentication → Sign In / Providers:**
   - Turn **off** "Allow new users to sign up". Only admins make accounts, through the admin API.
   - Keep Email as the provider. Veriq never asks Supabase to send email: accounts are made with the email already confirmed, and passwords are reset by an admin in the app.
2. Check, then apply migration 8:
   ```powershell
   npx supabase db push --db-url "<SUPABASE_DB_URL from .env.local>" --dry-run   # lists only 20261026000008_staff_admin.sql
   npx supabase db push --db-url "<SUPABASE_DB_URL from .env.local>"
   ```
3. Vercel → Environment Variables (Production): set `DEMO_LOGIN=off` on the real site.
   - Keep `SESSION_SECRET`; it now signs real staff sessions too.
   - Never set `VERIQ_LOCAL_ADMIN` or `VERIQ_DATA` on Vercel.
   - The pitch demo then needs a separate deploy (for example a Preview) without `DEMO_LOGIN=off`.
4. Make the first admin, on this computer:
   ```powershell
   npm run create-admin -- you@example.org
   ```
   It prints a one-time password in the terminal and nowhere else. Push the code, wait for Vercel, then sign in at `/staff/sign-in`. You will be asked to set your own password.
5. Check that it works:
   - `/admin` shows the three to-do counts.
   - On `/admin/staff`, make a test hospital account. Sign in as it in a private window and set its password. It should say "Waiting for verification".
   - Switch the test account off afterwards.

## The demo deployment (pitch site), added 2026-10-27

A second Vercel project, built from the same GitHub repository and pointing at the same Supabase
database. It opens in demo mode, so the whole 90-second demo (SPEC section 9) runs, including the
hospital and insurer demo logins (steps 6 and 8). The real site stays as it is (`DEMO_LOGIN=off`).

1. vercel.com → Add New → Project → import the same `veriq` repository again. Name it `veriq-demo`
   (the site becomes `https://veriq-demo.vercel.app`, or the name Vercel offers).
2. Environment Variables, **Production** of this new project:
   - The same values as the real site: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
     `SUPABASE_SERVICE_ROLE_KEY`, `REPORT_HASH_SECRET`, `SESSION_SECRET`, `CRON_SECRET`.
   - `VERIQ_DEMO_SITE` = `on` (opens in demo mode; sends no morning reminders, so no one gets two).
   - Do **not** add `DEMO_LOGIN` (unset means the demo login is on) or `REPORTS_LIVE` (unset means
     reports on real hospitals stay closed, rule R1).
3. Settings → Deployment Protection: make sure **Vercel Authentication is off for Production**, so a
   phone that isn't signed in to Vercel can open the site.
4. Deploy. Then open `https://<demo site>/admin/demo` → Demo login → **Reset demo data**.
5. Run the live checks against it:
   ```powershell
   $env:E2E_BASE_URL="https://<demo site>"; npx playwright test demo directory staff-demo find-results perf
   ```
   They reset the demo data before and after. `staff.spec.ts` and the /admin location test skip
   themselves on a deployed site, because they would make real accounts or change real data.

Before every pitch: `/admin/demo` → Reset demo data. Akoma's antenatal clinic then reads "Open till"
about 4 hours ahead, kept between 12 pm and 8 pm (or plain "Open" after a reset from 7 pm), so it
can't turn into "Was open till …" during the pitch (migration 10).
