# Veriq Health progress
Last updated: 2026-10-22, session 2026-10-22-01
Current phase: 1. Gate status: not met

## Prompts
### Phase 1: pitch demo
- [x] Prompt 0: Rules and progress files (2026-10-22-01)
- [ ] Prompt 1: Scaffold
- [ ] Prompt 2: Database and sample data
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
| 1 | Find care | `/find` | 1 | not started | |
| 2 | Results | `/results` | 1 | not started | Map button is Phase 2 |
| 3 | Hospital detail | `/facility/[id]` | 1 | not started | |
| 4 | Was your card accepted? | `/facility/[id]/report` | 1 | not started | |
| 5 | My cards | `/cards` | 1 | not started | |
| 6 | Emergency mode | `/emergency` | 1 | not started | |
| 7 | First open | `/` | 1 | not started | |
| 8 | Map view | `/results/map` | 2 | not started | |
| 9 | Saved and alerts | `/saved` | 2 | not started | |
| 10 | Share with family | `/facility/[id]/share` | 2 | not started | |
| 11 | After a report | `/report/thanks` | 1 | not started | |
| 12 | Offline | global state | 2 | not started | |
| 13 | Help: USSD and SMS | `/help` | 1 static, 2 live | not started | Phase 1 also needs tested `/api/ussd` |
| 14 | How Veriq checks | `/how-we-check` | 1 | not started | |
| 15 | Hospital: claim your page | `/h/onboard` | 2 | not started | |
| 16 | Hospital morning check | `/h/check` | 1 | not started | |
| 17 | Link to national bed system | `/h/national` | 3 | not started | Only after a signed agreement |
| 18 | Insurer network health | `/i/network` | 1 (read-only) | not started | |
| 19 | Insurer list upload | `/i/upload` | 2 | not started | |
| – | Admin | `/admin` | 2 | not started | Phase 1 only needs the demo reset (Prompt 8) |

## Known bugs
- none yet

## Open questions for the team
- The 19 screen images are not yet in `design/screens/`. Please add them before Prompt 4.

## Next prompt
Prompt 1: Scaffold
