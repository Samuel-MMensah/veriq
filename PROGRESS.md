# Veriq Health progress
Last updated: 2026-10-24, session 2026-10-24-04
Current phase: 1. Gate status: met on 2026-10-24 (demo rehearsed by hand on a phone by the team)
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

### Phase 2: pilot (prompts to be written in full after the pitch)
- [ ] Prompt 9: Real staff auth, admin verification of hospitals, held-report review
- [ ] Prompt 10: Hospital onboarding (screen 15), SMS morning-check reminders
- [ ] Prompt 11: Map view with Leaflet and OpenStreetMap (screen 8)
- [ ] Prompt 12: Saved hospitals, alerts, sharing (screens 9 and 10)
- [ ] Prompt 13: Full offline and low-data mode (screen 12)
- [ ] Prompt 14: Live SMS and USSD through the chosen aggregator
- [ ] Prompt 15: Insurer list upload, matching and conflicts (screen 19)
- [ ] Prompt 16: Languages, privacy notice, pilot analytics

## Screens
| # | Screen | Route | Phase | Status (not started, in progress, done) | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | Find care | `/find` | 1 | done | saved cards first since Prompt 6 |
| 2 | Results | `/results` | 1 | done | answer-first badge ("Takes NHIS"); "Map soon" removed (Phase 2); empty state offers wider search |
| 3 | Hospital detail | `/facility/[id]` | 1 | done | Share and Save are Phase 2 |
| 4 | Was your card accepted? | `/facility/[id]/report` | 1 | done | works offline (queued on the phone) |
| 5 | My cards | `/cards` | 1 | done | IndexedDB only; Find lists saved cards first |
| 6 | Emergency mode | `/emergency` | 1 | done | rule S2; cards are notes only; Call and Go per unit; 112/193 stream first |
| 7 | First open | `/` | 1 | done | other languages "coming soon" until Phase 2 |
| 8 | Map view | `/results/map` | 2 | not started | |
| 9 | Saved and alerts | `/saved` | 2 | not started | Phase 1 tab offers the last search again (tab kept, team decision) |
| 10 | Share with family | `/facility/[id]/share` | 2 | not started | |
| 11 | After a report | `/report/thanks` | 1 | done | top-up reports explain the hospital's morning-check prompt |
| 12 | Offline | global state | 2 | not started | |
| 13 | Help: USSD and SMS | `/help` | 1 static, 2 live | done (Phase 1) | `/api/ussd` tested; SMS through the console stub until Prompt 14 |
| 14 | How Veriq checks | `/how-we-check` | 1 | done | |
| 15 | Hospital: claim your page | `/h/onboard` | 2 | not started | |
| 16 | Hospital morning check | `/h/check` | 1 | done | demo login (Akoma); reminder via console stub |
| 17 | Link to national bed system | `/h/national` | 3 | not started | Only after a signed agreement |
| 18 | Insurer network health | `/i/network` | 1 (read-only) | done | demo login (NHIS); "Add to list" waits for screen 19 |
| 19 | Insurer list upload | `/i/upload` | 2 | not started | |
| – | Admin | `/admin` | 2 | Phase 1 part done | `/admin/demo`: Reset demo data, Make this phone fresh (demo login) |

## Known bugs
- "Open till 4 pm" still shows after 4 pm (status note is free text, no end time), medium, found 2026-10-24-04
- Insurer "turned away" table scrolls sideways at 390 px, low, found 2026-10-24-04

## Open questions for the team
- Add the approved answer wording to SPEC section 4 (`verdict` in lib/rules/badge.ts): "Takes {card}", "{card} not confirmed yet", "Patients report {card} refusals", "Does not take {card}".
- SPEC.md section 4 still has the old badge wording ("were refused", "confirmed this month"). The team chose period-named wording on 2026-10-22 (see docs/DECISIONS.md); please update SPEC.md so the two agree.

## Next prompt
Phase 1 gate met (2026-10-24). Phase 2, Prompt 9: Real staff auth, admin verification of hospitals, held-report review. Write it in full first (SPEC section 8), after the pitch. Before it: commit, let Vercel redeploy, and re-run the live demo and 3G checks.
