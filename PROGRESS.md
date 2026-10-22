# Veriq Health progress
Last updated: 2026-10-22, session 2026-10-22-04
Current phase: 1. Gate status: not met

## Prompts
### Phase 1: pitch demo
- [x] Prompt 0: Rules and progress files (2026-10-22-01)
- [x] Prompt 1: Scaffold (2026-10-22-02, fix-up 2026-10-22-03)
- [x] Prompt 2: Database and sample data (2026-10-22-04)
- [ ] Prompt 3: Rules engine, tests first
- [ ] Prompt 4: Find, results, hospital page
- [ ] Prompt 5: The report loop
- [ ] Prompt 6: Cards, emergency, help
- [ ] Prompt 7: Hospital and insurer views
- [ ] Prompt 8: Demo mode, polish, deploy

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
| 1 | Find care | `/find` | 1 | in progress | placeholder page (Prompt 1) |
| 2 | Results | `/results` | 1 | in progress | Map button is Phase 2; placeholder page (Prompt 1) |
| 3 | Hospital detail | `/facility/[id]` | 1 | in progress | placeholder page (Prompt 1) |
| 4 | Was your card accepted? | `/facility/[id]/report` | 1 | in progress | placeholder page (Prompt 1) |
| 5 | My cards | `/cards` | 1 | in progress | placeholder page (Prompt 1) |
| 6 | Emergency mode | `/emergency` | 1 | in progress | placeholder page (Prompt 1) |
| 7 | First open | `/` | 1 | in progress | placeholder page (Prompt 1) |
| 8 | Map view | `/results/map` | 2 | not started | |
| 9 | Saved and alerts | `/saved` | 2 | not started | |
| 10 | Share with family | `/facility/[id]/share` | 2 | not started | |
| 11 | After a report | `/report/thanks` | 1 | in progress | placeholder page (Prompt 1) |
| 12 | Offline | global state | 2 | not started | |
| 13 | Help: USSD and SMS | `/help` | 1 static, 2 live | in progress | Phase 1 also needs tested `/api/ussd`; placeholder page (Prompt 1) |
| 14 | How Veriq checks | `/how-we-check` | 1 | in progress | placeholder page (Prompt 1) |
| 15 | Hospital: claim your page | `/h/onboard` | 2 | not started | |
| 16 | Hospital morning check | `/h/check` | 1 | in progress | placeholder page (Prompt 1) |
| 17 | Link to national bed system | `/h/national` | 3 | not started | Only after a signed agreement |
| 18 | Insurer network health | `/i/network` | 1 (read-only) | in progress | placeholder page (Prompt 1) |
| 19 | Insurer list upload | `/i/upload` | 2 | not started | |
| – | Admin | `/admin` | 2 | not started | Phase 1 only needs the demo reset (Prompt 8) |

## Known bugs
- none known. The SQL is tested in PGlite but hasn't run on a real Supabase project yet (medium risk, 2026-10-22-04)

## Open questions for the team
- none (answered 2026-10-22: the demo insurer login for screen 18 is NHIS)

## Next prompt
Prompt 3: Rules engine, tests first
