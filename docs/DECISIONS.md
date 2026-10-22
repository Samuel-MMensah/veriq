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
