# Deploying Veriq Health (Phase 1 pitch demo)

Vercel, from GitHub. The database is the Supabase project already set up (migrations 1–5 applied).

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
