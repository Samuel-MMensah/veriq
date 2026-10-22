# Decisions

One line per decision the spec didn't make: date, decision, reason.

- 2026-10-22: The PROGRESS.md screen table has Route and Phase columns. Reason: Prompt 0 asks for each screen's phase.

- 2026-10-22: TypeScript pinned to 6.0, not 7. Reason: typescript-eslint (used by eslint-config-next) supports only TypeScript below 6.1.
- 2026-10-22: `/saved` shows a one-line "coming in the pilot" note. Reason: the bottom bar must have a Saved tab (section 2), but screen 9 is Phase 2, so the tab shouldn't 404 and the screen shouldn't be built early.
- 2026-10-22: Phase 2 and 3 route folders, `app/api/*`, `lib/*` and `supabase/migrations` exist only as empty folders (`.gitkeep`). Reason: section 5 asks for the folders; rule files are written tests-first in Prompt 3, and later-phase screens wait for their gate.
- 2026-10-22: PWA icons are SVG for now (normal and maskable). Reason: there are no brand assets yet; PNG icons can be added during the Prompt 8 polish.
- 2026-10-22: No service worker yet, only the manifest. Reason: Prompt 1 asks for the manifest; offline behaviour comes with the report queue (Prompt 5) and screen 12 (Phase 2).
- 2026-10-22: SAMPLE DATA tag goes on the hospital-data screens (find, results, hospital detail, report, thanks, emergency, morning check, insurer network), not on first open, how we check, help or my cards. Reason: rule 1 covers "screens with data"; cards are the user's own device data.
- 2026-10-22: Playwright tests a production build on port 3100 at 390 px wide (Pixel 7 profile). Reason: rule 7 (mobile first), and a production build is closer to the deployed site.
- 2026-10-22: Staff screens (`/h/*`, `/i/*`) do not show the patient bottom bar. Reason: section 2 calls it the patient bottom bar.
- 2026-10-22: Patient screens have a white background; page grey (#F4F6F5) is for panels inside a screen. Reason: the screen images show white screens, and section 2 says to match the images' colours.
- 2026-10-22: First open (`/`) stays in the `(patient)` folder as section 5 says, and the bottom bar hides itself there. Reason: screen 7 is a full-screen welcome with no bottom bar.
- 2026-10-22: `insurers` has a `slug` column (e.g. `nhis`). Reason: the results URL carries the card as `card=`, and a short readable id is better there than a UUID.
- 2026-10-22: `hospital_responses` has a nullable `item` column. Reason: rule T works per facility, insurer and item, so a top-up confirmation or correction must say which item it is about.
- 2026-10-22: `search_daily` has a `searches` count column. Reason: section 3 lists only the key fields; a counts-only table needs a count.
- 2026-10-22: `facilities.is_sample` defaults to true. Reason: rule 1, so nothing can be added as real data by accident before Phase 2.
- 2026-10-22: Live reports are read through a `public_card_reports` view without `device_hash` or `state`; the `card_reports` table has no public read policy. Reason: section 3 lets anyone read live report counts, and rule 2 keeps device hashes private.
- 2026-10-22: A trigger stops anyone but admin changing `facility_insurers.listed_by`, and only admin writes the `facilities` row itself. Reason: hospitals may confirm their own cards (rule M) but must not put themselves on a list or mark themselves verified.
- 2026-10-22: `area_cell` is the south-west corner of a 0.02 degree cell (about 2 km), written "lat,lng" with two decimals. Reason: rule K says cells of about 2 km; Prompt 3's lib/geo.ts must use the same format.
- 2026-10-22: Sample phone numbers are deliberately invalid (`+233 000 000 0NN`). Reason: an invented hospital must never ring a real number.
- 2026-10-22: The seed tells the insurer story for NHIS: 23 refusals at 6 hospitals, Pinecrest 9, and Akoma not on the NHIA list but confirmed by the hospital. Reason: it fits the demo script and screens 2, 3 and 18 together. Where the images disagree (Akoma "9 patients agree" vs "12 members served"), the patient screen wins: 9. Confirmed by the team on 2026-10-22: the demo insurer login (Prompt 7) is NHIS.
- 2026-10-22: Database tests run the real migrations and seed in PGlite (in-memory Postgres) with a small Supabase shim, plus a minimal stand-in for the supabase-js query builder. Reason: there is no Docker or Supabase project on this machine, and it keeps `npm test` self-contained.
- 2026-10-22: Migrations and the seed are pushed with `npx supabase db push --db-url "$SUPABASE_DB_URL" [--include-seed]`, using the Session pooler URI kept in `.env.local`. Reason: the direct database host is IPv6-only and doesn't resolve on this network; this avoids `supabase login`.
- 2026-10-22: `supabase/config.toml` (from `supabase init`, default settings) is kept in the repo. Reason: `db push --include-seed` reads the seed path from it, and Prompt 8's reset will need the same seed.
- 2026-10-22: `lib/db/types.ts` is written by hand. Reason: there is no Supabase project to generate it from yet; `supabase gen types` can replace it later.
