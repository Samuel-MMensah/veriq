# Veriq Health progress
Last updated: 2026-10-27, session 2026-10-27-02 (pitch-ready fix-up; review: docs/REVIEW-2026-10-27.md)
Current phase: 2 (pilot). Phase 1 gate met on 2026-10-24. Phase 2 gate: not yet (needs DPC registration, real logins live, rule A in production, USSD aggregator; real logins and admin verification are built but not yet deployed)
Live: https://veriqhealth.vercel.app (Vercel, functions in Dublin; Supabase eu-west-1)

## Prompts
### Phase 1: pitch demo
- [x] Prompt 0: Rules and progress files (2026-10-22-01)
- [x] Prompt 1: Scaffold (2026-10-22-02, fix-up 2026-10-22-03)
- [x] Prompt 2: Database and sample data (2026-10-22-04, live on Supabase 2026-10-22-05)
- [x] Prompt 3: Rules engine, tests first (2026-10-22-06, fix-up 2026-10-22-07)
- [x] Prompt 4: Find, results, hospital page (2026-10-22-08, fix-up 2026-10-22-09)
- [x] Prompt 5: The report loop (2026-10-22-10)
- [x] Prompt 6: Cards, emergency, help (2026-10-22-11)
- [x] Prompt 7: Hospital and insurer views (2026-10-24-01)
- [x] Prompt 8: Demo mode, polish, deploy (2026-10-24-02, live checks 2026-10-24-03, UX/trust/accessibility audit 2026-10-24-04)

### Phase 2: pilot (each prompt written in full in SPEC section 8 before it runs)
- [x] Prompt 9: Real NHIA directory for Greater Accra (2026-10-26-01; live and checked on the live site 2026-10-26)
- [x] Prompt 10: Real staff sign-in, admin side, design pass (2026-10-26-02; deployed, migration 8 applied, an admin account exists; checked in the 2026-10-27 review)
- [ ] Prompt 11: Hospital onboarding (screen 15), SMS morning-check reminders
- [ ] Prompt 12: Map view with Leaflet and OpenStreetMap (screen 8)
- [ ] Prompt 13: Saved hospitals, alerts, sharing (screens 9 and 10)
- [ ] Prompt 14: Full offline and low-data mode (screen 12)
- [ ] Prompt 15: Live SMS and USSD through the chosen aggregator
- [ ] Prompt 16: Insurer list upload, matching and conflicts (screen 19)
- [ ] Prompt 17: Languages, privacy notice, pilot analytics

## Screens
| # | Screen | Route | Phase | Status (not started, in progress, done) | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | Find care | `/find` | 1 | done | saved cards first since Prompt 6 |
| 2 | Results | `/results` | 1 | done | answer-first badge; real NHIA facilities in "Services not listed. Call to ask" (rule D3); Call row on "Call first" cards; SAMPLE DATA only with demo hospitals |
| 3 | Hospital detail | `/facility/[id]` | 1 | done | real facilities: NHIA type, source line, OSM credit, reports closed (rule R1); Share and Save are Phase 2 |
| 4 | Was your card accepted? | `/facility/[id]/report` | 1 | done | works offline; closed on real facilities until REPORTS_LIVE=on (rule R1) |
| 5 | My cards | `/cards` | 1 | done | IndexedDB only; Find lists saved cards first |
| 6 | Emergency mode | `/emergency` | 1 | done | rule S2 with the real-hospital addition ("Emergency not checked. Call first"); 112/193 stream first |
| 7 | First open | `/` | 1 | done | other languages "coming soon" until Phase 2 |
| 8 | Map view | `/results/map` | 2 | not started | |
| 9 | Saved and alerts | `/saved` | 2 | not started | Phase 1 tab offers the last search again (tab kept, team decision) |
| 10 | Share with family | `/facility/[id]/share` | 2 | not started | |
| 11 | After a report | `/report/thanks` | 1 | done | top-up reports explain the hospital's morning-check prompt |
| 12 | Offline | global state | 2 | not started | |
| 13 | Help: USSD and SMS | `/help` | 1 static, 2 live | done (Phase 1) | `/api/ussd` tested (`?demo=1` is the demo line; R1 on the real line); SMS through the console stub until Prompt 15 |
| 14 | How Veriq checks | `/how-we-check` | 1 | done | |
| 15 | Hospital: claim your page | `/h/onboard` | 2 | not started | |
| 16 | Hospital morning check | `/h/check` | 1 | done | real accounts (verified hospitals publish) and the demo login (Akoma); optional till time per service (rule F); reminder via console stub |
| 17 | Link to national bed system | `/h/national` | 3 | not started | Only after a signed agreement |
| 18 | Insurer network health | `/i/network` | 1 (read-only) | done | real insurer accounts see real facilities; demo login (NHIS) sees the demo; "Add to list" waits for screen 19 |
| 19 | Insurer list upload | `/i/upload` | 2 | not started | |
| – | Admin | `/admin` | 2 | done | overview, staff accounts, hospital verification, held reports, locations (search and map preview), admin log, demo data, design sample (`/admin/design`) |
| – | Staff sign-in | `/staff/sign-in`, `/staff/password` | 2 | done | email and password, accounts made by an admin, nothing emailed |

## Known bugs
- The full 90-second demo doesn't run on the production URL (demo login off there, by design). Fixed by the demo deployment (VERIQ_DEMO_SITE=on, docs/DEPLOY.md), which the team still has to create in Vercel; checked locally only, high, found 2026-10-27-01
- Live 3G first content was 1.2–2.8 s after Prompt 10 (varies with the network). CSS is now inlined and the font isn't preloaded: 0.34–0.42 s locally (was 0.98 s); not yet measured live (needs the deploy), medium, found 2026-10-27-01
- Two e2e tests failed once in a slow demo-site run ("emergency: no WCAG 2 AA problems (axe)" timed out; "offline: the report waits…" missed its 10 s poll) and passed 3 of 3 on repeat: flaky, low, found 2026-10-27-02

## Open questions for the team
- The review's questions still open: docs/REVIEW-2026-10-27.md, section 14 (Supabase sign-ups off? who places the 360 locations? NHIA permission? DPC registration date? pilot insurer?)
- Who asks NHIA for permission to republish the provider list, and for a dated copy with NHIA codes and phone numbers?

## Next prompt
Before any new prompt: apply migration 9 (`npx supabase db push`), commit and push, create the demo deployment in Vercel (docs/DEPLOY.md, "The demo deployment"), then run the live checks against it and the 3G check on production. Then Prompt 11: hospital onboarding (screen 15) and morning-check reminders (write it in full in SPEC section 8 first).
