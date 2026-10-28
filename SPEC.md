# Veriq Health Build Spec (for Claude Code)

Oct 22, 2026 · @Sam

## 0. How to use this spec

**Export this doc as Markdown, save it as `SPEC.md` in an empty project folder named `veriq/`, open Claude Code there, and paste Prompt 0.** After that, paste one prompt per session, in order. This document is the single source of truth; if code and spec disagree, the spec wins unless we change the spec.

**Files Claude Code keeps in the repo**

| File | Who writes it | What it holds |
| --- | --- | --- |
| `SPEC.md` | Us (exported from this doc) | The product, screens, data, rules and prompts. Claude Code never edits it. |
| `CLAUDE.md` | Claude Code, in Prompt 0 | Short standing rules it reads at the start of every session. |
| `PROGRESS.md` | Claude Code, every session | The live checklist: each prompt's status, known bugs, open questions, and the next prompt to run. |
| `docs/sessions/YYYY-MM-DD-NN.md` | Claude Code, end of every session | The session report (template in section 7). |
| `design/screens/*.png` | Us | The 19 screen images, so Claude Code can match the layout. |
| `docs/DECISIONS.md` | Claude Code, when it makes a choice the spec didn't | One line per decision: date, decision, reason. |

**The rhythm for every session**

1. Start: paste the next prompt. Claude Code first reads `CLAUDE.md`, `PROGRESS.md` and the latest session report.
2. Work: it builds only that prompt's scope, runs the tests and fixes what fails.
3. End: it writes the session report, updates `PROGRESS.md`, and stops. It doesn't start the next prompt.
4. You: read the report, click through the app, then commit. If something is wrong, say so in plain words, for example "the badge on Pinecrest should be orange, see SPEC section 4, rule B1".

If a session runs out of room mid-prompt, type **"Wrap up now: write the session report and update PROGRESS.md."** The next session picks up from there.

## 1. Product

**Veriq Health shows people in Ghana, before they travel, which hospitals really accept their insurance card, what is open today, and what patients actually paid. Every fact shows its source and its age.** Tagline: "Know before you go."

| User | Signs in? | Main jobs |
| --- | --- | --- |
| Patient or family member | No (anonymous; cards saved on the device) | Search by service and card, view a hospital, report whether the card worked, save hospitals, share a plan, open emergency mode |
| Hospital front desk | Yes, phone number plus a one-time code (stubbed in Phase 1) | Claim the page, do the morning check, confirm or correct patient reports |
| Insurer staff | Yes, email plus a one-time code (stubbed in Phase 1) | See network health, upload the provider list, resolve conflicts |
| Veriq admin | Yes | Verify hospitals, review flagged reports, manage sample data |

**Non-negotiable rules**

1. **Real facilities only from a named public source; demo facilities only in demo mode.** Real facilities come only from a named public source, for now the NHIA list of accredited providers. Demo facilities (`source = demo`) are invented and show only in demo mode (rule D2). The "SAMPLE DATA" tag shows whenever a demo facility is on the screen, and only then.
2. **Never store patient identity.** No names or card numbers on the server. Saved cards live in the browser (IndexedDB). Reports carry only a random device ID and a hash.
3. **The card never hides a hospital in emergency mode.** Emergency results sort by status and distance only.
4. **Every fact has a source and a timestamp**, and the screen says which. No unsourced "available".
5. **Money never changes a badge or a ranking.** No code path may read a payment or plan field in badge or sort logic.
6. **Rules, not AI.** Badges, sorting and top-ups are plain, tested functions in `lib/rules/`.
7. **Mobile first.** Design at 390 px wide; touch targets at least 44 px; it must work on a cheap Android phone over 3G.
8. **Offline-tolerant.** The last search area is cached; reports queue and send when back online.
9. **Plain words.** Short sentences, no medical jargon, Ghana cedi shown as GH¢.

**Out of scope (all phases unless stated):** appointment booking, payments by patients, medical records, telemedicine, ambulance dispatch (that is the government's IBMRCS), AI symptom checking, and native app-store apps until after the pilot.

## 2. Screens and routes

**19 screens; Phase 1 builds 12 of them.** Numbers match the design canvas and the images in `design/screens/`. Match the layout, colours and wording in the images; where text below differs, follow the text.

**Colours:** brand green #0B6E4F, ink #16201C, page grey #F4F6F5, emergency red #8A1C12, refused orange #C2570C on #FDF0E6, patient-confirmed green #5FAE8E. **Font:** Plus Jakarta Sans. **Patient bottom bar:** Find, Cards, Saved, Help.

| # | Screen | Route | Phase | Must show and do |
| --- | --- | --- | --- | --- |
| 7 | First open | `/` (first visit only, then `/find`) | 1 | Promise, three points, language picker (English live, others marked "coming soon" until Phase 2), Get started, link to How we check |
| 1 | Find care | `/find` | 1 | SAMPLE DATA tag; emergency banner to `/emergency`; service chips (Antenatal/maternity, See a doctor, Scan/X-ray, Lab test, Specialist, Dental); card picker (saved cards first, then NHIS, Cosmopolitan Health, Prudential, No card/cash); area from GPS or typed, default 5 km; button "Show hospitals that take {card}" |
| 2 | Results | `/results?service=&card=&lat=&lng=` | 1 | Count and filters; badge legend; one card per hospital: name, distance, badge line (rule B), today's status for the chosen service, top-up (rule T); sort by rule S1; Call button on "Call first" cards; when nothing is found, a wider search and "See every hospital nearby"; "How Veriq checks" link; Map button (Phase 2) |
| 3 | Hospital detail | `/facility/[id]` | 1 | Name, type, area, distance; Call (`tel:`), Directions (Google Maps URL); "Today" grid with status and update time; cards accepted, each with badge and source line; top-up note; button to report |
| 4 | Was your card accepted? | `/facility/[id]/report` | 1 | Three options: fully covered, paid extra (optional amount and item chips: Scan, Drugs, Lab, Registration), refused; privacy note; Send queues the report (works offline) |
| 11 | After a report | `/report/thanks` | 1 | What changed on the hospital page; counts of the user's reports (local) |
| 14 | How Veriq checks | `/how-we-check` | 1 | The four badges in plain words, the freshness rule, "hospitals can't pay for a badge" |
| 5 | My cards | `/cards` | 1 | Cards in IndexedDB only: insurer, last 4 digits, holder nickname, expiry, dependants; renewal reminder a month before NHIS expiry ("dial \*929#"); add card |
| 6 | Emergency mode | `/emergency` | 1 | Call 112 and 193; nearest emergency units sorted by rule S2; card shown as information only; note that ambulance crews use the national system |
| 16 | Hospital morning check | `/h/check` | 1 | Toggles per service (Accepting/Full, Open/Closed, Working/Down, specialist time); weekly card check; patient-report prompts to confirm or correct; reach count; "Confirm and publish" |
| 18 | Insurer network health | `/i/network` | 1 (read-only) | Four KPI tiles (rule K), "where members were turned away" table, coverage gaps |
| 13 | Help: USSD and SMS | `/help` | 1 static, 2 live | Phase 1: explain the USSD menu and SMS reply, code shown as a placeholder, plus a tested `/api/ussd` handler. Phase 2: live through an aggregator. |
| 8 | Map view | `/results/map` | 2 | OpenStreetMap (Leaflet) pins coloured by badge; bottom sheet for the selected hospital |
| 9 | Saved and alerts | `/saved` | 2 | Saved hospitals (local); alerts when a saved hospital's badge or status changes; SMS alerts option. Until then the Saved tab shows the last search (rule 8) |
| 10 | Share with family | `/facility/[id]/share` | 2 | Plain-text plan; WhatsApp (`https://wa.me/?text=`), SMS (`sms:?body=`), copy |
| 12 | Offline | global state | 2 | Offline banner, last saved area, queued reports, low-data mode |
| 15 | Hospital: claim your page | `/h/onboard` | 2 | Three steps: details, services and cards, hours; names the morning-check contact; "verified" only after admin approval |
| 19 | Insurer list upload | `/i/upload` | 2 | Upload CSV/XLSX, match to facilities, show conflicts with reports, publish |
| 17 | Link to national bed system | `/h/national` | 3 | Consent toggle, what is and isn't shared, bed counts; disabled until an agreement exists |
| – | Admin | `/admin` | 2 | Verify hospitals, review held reports, edit insurers. Phase 1 only needs the demo reset (Prompt 8). |

### Screen images

&#91;image: Screens 7, 1 and 2\]

&#91;image: Screens 3, 8 and 14\]

&#91;image: Screens 4, 11 and 10\]

&#91;image: Screens 5, 9 and 6\]

&#91;image: Screens 12 and 13\]

&#91;image: Screens 15, 16 and 17\]

&#91;image: Screen 18, insurer network health\]

&#91;image: Screen 19, insurer list upload\]

## 3. Data model

**Postgres on Supabase. Badges and sorting are computed in code from these tables, not stored.** All ids are UUIDs unless noted; every table has `created_at`.

| Table | Key fields | Notes |
| --- | --- | --- |
| `facilities` | name, type (`public`, `mission`, `private`, `quasi`), region, district, area, lat, lng, phone, verified (bool), verified\_at, nhia\_listed (bool), is\_sample (bool), source (`nhia`, `demo`), source\_ref (the row or code in the source file), source\_date, nhia\_type (the facility type as the file writes it), location\_source (`osm`, `admin`, `none`), location\_checked\_at | Demo: 15–20 invented Greater Accra facilities, `source = demo`, `is_sample = true`. Real: imported from the NHIA list (Prompt 9), `source = nhia` (rules D1–D3) |
| `services` | id (slug, e.g. `antenatal`), name, category | Seed: antenatal, delivery, c\_section, emergency, ultrasound, xray, ct, lab, gp, paediatrics, dental, obstetrician |
| `facility_services` | facility\_id, service\_id, offered (bool), usual\_hours (text) | What a facility offers at all |
| `status_updates` | facility\_id, service\_id, status (`open`, `closed`, `accepting`, `full`, `working`, `down`, `from_time`), from\_time, until\_time (nullable), note, source (`hospital`, `admin`), created\_by | Append-only. Current status = newest row per facility and service, until its `until_time` passes (rule F). |
| `insurers` | name, kind (`public`, `private`) | Seed: NHIS, Cosmopolitan Health, Prudential, plus two invented private insurers |
| `facility_insurers` | facility\_id, insurer\_id, listed\_by (`nhia`, `insurer`, `none`), hospital\_says (`accepts`, `does_not`, `partial`, null), hospital\_confirmed\_at | One row per pair. The hospital's own answer and the lists live here. |
| `card_reports` | facility\_id, insurer\_id, service\_id (nullable), outcome (`covered`, `topup`, `refused`), amount\_ghs (nullable), item (`scan`, `drugs`, `lab`, `registration`, nullable), device\_hash, state (`live`, `held`, `rejected`) | No names, no card numbers, no IP addresses stored |
| `hospital_responses` | facility\_id, insurer\_id, kind (`confirm_topup`, `correct_topup`, `dispute_refusals`), amount\_ghs, note | Shown on the hospital page beside the patient reports |
| `profiles` | user\_id (Supabase auth), role (`hospital`, `insurer`, `admin`), facility\_id, insurer\_id, phone | Staff only. Patients have no profile. |
| `reach_daily` | facility\_id, day, views, search\_hits | Counts only, for the "people found you" figure |
| `insurer_uploads` (Phase 2) | insurer\_id, filename, row\_count, matched, conflicts (jsonb), published\_at |  |
| `alert_subscriptions` (Phase 2) | device\_id, facility\_id, channel (`push`, `sms`), phone\_hash |  |
| `national_shares` (Phase 3) | facility\_id, consented\_by, consented\_at, last\_sent\_at |  |

**Access rules (row-level security):** anyone can read facilities, services, current status, insurer links and live report counts. Reports are inserted only through the `/api/reports` route, which applies the limits in rule A. Hospital staff can write only their own facility's rows. Insurer staff can read only aggregates for their own insurer. Admin can do everything.

**On the device (IndexedDB):** saved cards, saved hospitals, the user's own report count, the cached last search area, and the queue of unsent reports.

## 4. Business rules

**Each rule has an id; code comments and tests cite it (for example `// rule B1`).** All rules live in `lib/rules/` as pure functions with unit tests, and take `now` as an argument so tests can fix the time.

**B. Card badge for a facility and insurer.** Look at live reports from the last 30 days. Check in order; the first match wins.

1. **B1 Reported refused:** at least 3 `refused` reports newer than `hospital_confirmed_at`, and more refused than accepted (`covered` + `topup`). Orange. Text: "Listed, but {n} patients were refused in the last 30 days" ({n} counts every refusal in the last 30 days).
2. **B2 Hospital confirmed:** `hospital_says` is `accepts` or `partial`, confirmed within 14 days. Dark green. Text: "Confirmed by hospital {age} ago" (add "with top-ups" when `partial`).
3. **B2x Hospital says no:** `hospital_says = does_not` within 14 days. Leave out of card searches; show "Not accepted (hospital)" on the detail page.
4. **B3 Patients confirmed:** at least 3 accepted reports and more accepted than refused. Light green. Text: "{n} patients confirmed in the last 30 days".
5. **B4 On a list, not checked:** `listed_by` is `nhia` or `insurer`. Grey. Text: "On {NHIA/insurer} list, not checked yet. Call first".
6. **B5 Unknown:** none of the above. Leave out of card searches; show under "No card/cash".

**Answer wording (team decision 2026-10-24).** Each badge is shown as an answer first, then its text above as the source line: B2 and B3 "Takes {card}"; B4 "{card} not confirmed yet"; B1 "Patients report {card} refusals"; B2x "Does not take {card}"; B5 "No {card} information".

**F. Status freshness** (per service, from the newest `status_updates` row): under 24 hours shown normally with the time; 24–72 hours adds "may have changed"; over 72 hours greyed with "not updated recently"; no row ever shows "No update yet". A status row may have an `until_time`. Once that time has passed, the status no longer counts as current: the screen shows "Was {status} till {time}. Call to check", and rules S1 and S2 sort it as unknown.

**T. Top-ups.** With at least 2 `topup` reports in 60 days for the same facility, insurer and item, show "{item} top-up about GH¢ {median} ({n} patients, last 60 days)", rounded to the nearest 5. A newer hospital `confirm_topup` shows "confirmed by hospital"; a newer `correct_topup` replaces the amount until at least 2 newer patient reports disagree.

**S1. Results order.** Keep facilities within the radius that offer the service and whose badge is B1–B4. Sort by badge (B2, B3, B4, then B1 last), then today's status for that service (open or accepting, then unknown, then closed or full), then distance. Distance is straight-line (haversine) in km, one decimal place.

**S2. Emergency order.** Facilities offering `emergency` within 15 km, sorted by emergency status (accepting, then unknown or stale, then full), then distance. **Never filter or reorder by card.** Show the user's cards' badges as information only. After the units with an emergency status, list real facilities whose NHIA type is a hospital or polyclinic, with no emergency status, as "Emergency not checked. Call first", sorted by distance, within 15 km. Pharmacies, clinics and facilities with no location are not listed in emergency mode. The card still never filters or reorders anything (rule 3).

**A. Report limits.** `device_hash` = SHA-256 of a random device id plus a server-side secret. One report per device per facility per 7 days; later attempts get a polite "already counted" message. More than 10 reports for one facility in an hour puts new ones in `held`. Held and rejected reports never count.

**K. Insurer figures, last 30 days:** hospitals on list (the insurer's own list, `listed_by = insurer`; for NHIS, the NHIA list counts too, `listed_by = nhia`, because NHIA keeps the NHIS list; a private insurer counts only its own list); confirmed (those at B2); members refused (count of `refused` reports, and the number of facilities); member searches (searches with that card, from a counts-only `search_daily` table: insurer\_id, day, area\_cell, had\_confirmed\_result); coverage gaps (area cells of about 2 km where searches found no B2 or B3 facility within 5 km).

**M. Morning check.** Hospital staff get an SMS reminder at 07:30 (stubbed to the console in Phase 1). Publishing writes one `status_updates` row per changed service and sets `hospital_confirmed_at` for every card they confirm.

**D. Directory (real facilities).**

1. **D1 Directory facts:** A real facility carries only what its source file says, plus a location from OpenStreetMap or an admin. Every directory fact shows its source and month: "From the NHIA list, October 2026". A facility with `location_source = none` is left out of every distance search and emergency mode, and listed on /admin under "Needs a location".
2. **D2 Demo separation:** Demo facilities show only with the demo login cookie or `?demo=1`. Real facilities never get demo reports, statuses, top-ups or hospital answers.
3. **D3 Services not listed:** For a service search with NHIS or No card / cash, real facilities with no confirmed services appear in a second group after the rule S1 results, headed "Services not listed. Call to ask". The group is sorted by distance only and shows the 10 nearest, then "Show more". Each card shows the NHIA type as written in the file and, for NHIS, its rule B badge (B4). Pharmacies never appear in this group. A service is never guessed from the facility type. Searches with a private card don't show this group.

**R. Reports on real facilities.**

1. **R1:** With `REPORTS_LIVE=off`, reports on real facilities are closed on the web and on USSD. The report screen says "Reporting opens soon. Call the hospital to check your card." Demo facilities keep reporting. `REPORTS_LIVE` turns on only after the Data Protection Commission registration.

## 5. Stack and folders

**Next.js (App Router) with TypeScript, Tailwind CSS, Supabase (Postgres and auth), deployed on Vercel.** Each piece has a free tier that covers the demo.

| Need | Choice |
| --- | --- |
| App | Next.js App Router, TypeScript strict mode, server components by default |
| Styling | Tailwind CSS with the colours in section 2 as theme tokens; Plus Jakarta Sans via `next/font` |
| Database and auth | Supabase. In Phase 1, staff log in with seeded demo accounts behind a "Demo login" button. |
| Offline | A PWA manifest and service worker; IndexedDB through the `idb` package |
| Maps | Phase 1: Google Maps direction links only. Phase 2: Leaflet with OpenStreetMap tiles. |
| SMS and USSD | Phase 1: `lib/messaging/` interface with a console stub. Phase 2: a Ghanaian aggregator behind the same interface. |
| Tests | Vitest for rules and API routes; Playwright for the demo-script flow |
| Hosting | Vercel, with Supabase environment variables in `.env.local` (never committed) |

```
veriq/
  SPEC.md  CLAUDE.md  PROGRESS.md
  docs/sessions/   docs/DECISIONS.md
  design/screens/  (screen images)
  app/
    (patient)/  page.tsx (first open)  find/  results/  results/map/
                facility/[id]/  facility/[id]/report/  facility/[id]/share/
                report/thanks/  cards/  saved/  emergency/  help/  how-we-check/
    h/          check/  onboard/  national/
    i/          network/  upload/
    admin/
    api/        reports/  status/  ussd/  search-log/
  components/   ui/  badges/  facility/  nav/
  lib/
    rules/      badge.ts  freshness.ts  topup.ts  sort.ts  limits.ts  kpi.ts (+ *.test.ts)
    db/         supabase.ts  queries.ts
    local/      cards.ts  saved.ts  queue.ts  (IndexedDB)
    messaging/  index.ts  console.ts
    geo.ts
  supabase/     migrations/  seed.sql
  tests/e2e/    demo.spec.ts
```

## 6. Phases and gates

**Build in phases with one prompt per session, not as one big goal.** A phase is finished only when its gate passes. Claude Code must not start the next phase's work early, even when it seems quick.

| Phase | Goal | Prompts | Gate (all must be true) |
| --- | --- | --- | --- |
| 1. Pitch demo | A deployed app on sample data that tells the whole story in 90 seconds | 0–8 | Demo script (section 9) passes as a Playwright test and by hand on a phone; all rule tests pass; deployed URL works on 3G throttling; every data screen shows SAMPLE DATA |
| 2. Pilot | Real data for about 20 Accra hospitals and one insurer | 9–17 | Data Protection Commission registration done; real hospital logins; reports pass rule A in production; USSD works through an aggregator; admin can verify hospitals |
| 3. Scale | More regions and the national link | 17+ | Signed data-sharing agreement with GHS and NAS before any national-link code goes live |

**Why phases:** a working demo exists early even if time runs out; each session is small enough to review and commit; Claude Code's memory resets between sessions, so small pieces with written handovers lose less; and the pilot should be shaped by what the validation calls and judges say.

## 7. Session protocol

**Every session starts by reading the handover and ends by writing one. No exceptions, including short fix-up sessions.**

**At the start**, Claude Code must:

1. Read `CLAUDE.md`, `PROGRESS.md` and the newest file in `docs/sessions/`.
2. Say in three lines what it understood: where the project stands, what this prompt asks, and anything blocking it.
3. Run the tests once, so it knows what was already broken before touching anything.

**At the end**, Claude Code must:

1. Run lint, type-check and all tests, and record the results honestly.
2. Write `docs/sessions/YYYY-MM-DD-NN.md` using the template below.
3. Update `PROGRESS.md`.
4. Print the report in the chat so we can read it without opening files.
5. Stop. Never start the next prompt on its own.

**Session report template**

```markdown
# Session YYYY-MM-DD-NN: Prompt {n}, {title}

## Summary
Two or three plain sentences: what works now that didn't before.

## Done
- {item}, see {file paths}, rule {id} if relevant

## Not done or partly done
- {item}: why, and what is left

## Tests
- Unit: {passed}/{total}. Failing: {names, or "none"}
- E2E: {passed}/{total}. Failing: {names, or "none"}
- Lint and type-check: {pass or fail}

## How to check it yourself
1. Run `npm run dev`, open {URL}
2. {click path and what you should see}

## Decisions I made
- {decision}: {reason} (also added to docs/DECISIONS.md)

## Problems and risks
- {bug or worry}: {severity: high, medium or low}

## Questions for you
- {question needing a human answer, or "none"}

## Next
The next prompt to run is Prompt {n+1}: {title}. Before it: {anything we must do, e.g. add Supabase keys}.
```

**`PROGRESS.md` template** (Claude Code keeps it current)

```markdown
# Veriq Health progress
Last updated: {date}, session {id}
Current phase: {1, 2 or 3}. Gate status: {not met, or met on date}

## Prompts
- [x] Prompt 0: Rules and progress files ({session id})
- [ ] Prompt 1: Scaffold
...

## Screens
| # | Screen | Status (not started, in progress, done) | Notes |

## Known bugs
- {bug}, {severity}, found {session id}

## Open questions for the team
- {question}

## Next prompt
Prompt {n}: {title}
```

## 8. Prompts

**Paste one prompt per session, in order. Each starts and ends the same way because `CLAUDE.md` makes Claude Code follow section 7.** If a prompt is too big for one session, Claude Code wraps up and the next session continues the same prompt.

### Phase 1: pitch demo

**Prompt 0: rules and progress files**

```text
Read SPEC.md fully. Do not write any app code in this session.
Create:
1. CLAUDE.md: a short list of standing rules taken from SPEC.md: the 9 non-negotiable rules (section 1), the rule ids in section 4 and that code must cite them, the phase gates (section 6), and the session protocol (section 7) word for word, including "never start the next prompt yourself".
2. PROGRESS.md from the template in section 7, listing Prompts 0-16 and all 19 screens with their phase.
3. docs/sessions/ and docs/DECISIONS.md (empty, with a heading).
4. design/screens/README.md saying the screen images go here.
Then finish with the end-of-session protocol.
```

**Prompt 1: scaffold**

```text
Start-of-session protocol first. Then build Prompt 1 from SPEC.md:
Set up Next.js (App Router, TypeScript strict), Tailwind with the section 2 colours as theme tokens, Plus Jakarta Sans via next/font, ESLint, Vitest and Playwright.
Create the folder structure in section 5 and a placeholder page for every Phase 1 route in section 2, each with its screen title.
Build the patient layout: bottom bar (Find, Cards, Saved, Help) and a reusable SampleDataTag component. Add a PWA manifest named "Veriq Health".
Add npm scripts: dev, build, lint, typecheck, test, e2e.
No database yet. End-of-session protocol.
```

**Prompt 2: database and sample data**

```text
Start-of-session protocol first. Then build Prompt 2 from SPEC.md:
Write Supabase migrations for every Phase 1 table in section 3, plus search_daily (rule K), with the access rules described there.
Write supabase/seed.sql with 18 invented facilities in Greater Accra (is_sample = true, invented names only), the services and insurers listed in section 3, and facility_insurers, status_updates and card_reports arranged so that every badge B1 to B5 and every freshness state in rule F appears at least once. Include the four demo hospitals shown in the screen images: Akoma Mission Hospital (B2 for NHIS, GH¢ 80 scan top-up), Lakeside Family Clinic (B3), Gbawe Community Clinic (B4) and Pinecrest Specialist Hospital (B1 for NHIS).
Use times relative to now() so the badges stay correct on any day.
Add lib/db/queries.ts with typed functions for the reads the screens need. Write down in the report any Supabase keys I must add.
End-of-session protocol.
```

**Prompt 3: rules engine, tests first**

```text
Start-of-session protocol first. Then build Prompt 3 from SPEC.md:
In lib/rules/ implement rules B, F, T, S1, S2, A and K from section 4 as pure functions that take `now` as an argument, plus lib/geo.ts (haversine).
Write the Vitest tests FIRST, with at least one test per numbered rule and edge cases at every threshold (exactly 3 reports, exactly 14 days, exactly 24 and 72 hours).
Add a test proving that no plan or payment field can reach badge or sort logic (rule 5).
No UI work. End-of-session protocol.
```

**Prompt 4: find, results, hospital page**

```text
Start-of-session protocol first. Then build Prompt 4 from SPEC.md:
Build screens 7 (first open), 1 (find care), 2 (results), 3 (hospital detail) and 14 (how Veriq checks) to match design/screens and section 2.
Results must use rules B, F, T and S1 from lib/rules, never their own logic. Badge colours and wording exactly as in section 4.
First open shows once (remember it in localStorage) and then goes to /find.
Log each search to search_daily (counts only).
Add a Playwright test: find antenatal with NHIS, see 4 results in the right order, open Akoma.
End-of-session protocol.
```

**Prompt 5: the report loop**

```text
Start-of-session protocol first. Then build Prompt 5 from SPEC.md:
Build screen 4 (report) and screen 11 (thanks).
Create POST /api/reports applying rule A (device hash, 7-day limit, burst holding). Generate the device id in IndexedDB.
Queue reports in IndexedDB when offline and send them when back online (lib/local/queue.ts).
The thanks screen shows what changed on the hospital page, recalculated with lib/rules.
Add tests: a 3rd refusal turns a B2 or B4 hospital into B1; a duplicate report within 7 days is refused politely.
End-of-session protocol.
```

**Prompt 6: cards, emergency, help**

```text
Start-of-session protocol first. Then build Prompt 6 from SPEC.md:
Build screen 5 (my cards): IndexedDB only, last 4 digits only, dependants, NHIS renewal reminder. Add a test that no card data is ever sent to the server.
Build screen 6 (emergency mode) with rule S2, 112 and 193 as tel: links, and cards shown as information only. Add a test that changing the card never changes emergency results.
Build screen 13 (help) as a static page, plus POST /api/ussd: a handler for the menu in the screen image that returns text responses, with tests. Send replies through lib/messaging (console stub).
End-of-session protocol.
```

**Prompt 7: hospital and insurer views**

```text
Start-of-session protocol first. Then build Prompt 7 from SPEC.md:
Add a "Demo login" for one seeded hospital user (Akoma) and one insurer user. Mark it clearly as demo-only.
Build screen 16 (morning check) at /h/check following rule M: service toggles, weekly card check, prompts to confirm or correct patient-reported top-ups, reach count, publish.
Build screen 18 (insurer network health) at /i/network, read-only, with rule K figures, the refusals table and coverage gaps.
Add an e2e test: the hospital marks antenatal Closed, and the results page shows it.
End-of-session protocol.
```

**Prompt 8: demo mode, polish, deploy**

```text
Start-of-session protocol first. Then build Prompt 8 from SPEC.md:
Add /admin/demo with a "Reset demo data" button that re-runs the seed.
Polish against the screen images: spacing, 44 px targets, focus styles, labels for icon buttons, colour contrast.
Check performance with 3G throttling and fix anything over 3 seconds to first content.
Write tests/e2e/demo.spec.ts following the demo script in section 9 exactly.
Deploy to Vercel. Give me the URL and the exact environment variables to set.
Check the Phase 1 gate in section 6 item by item and report each one as met or not met.
End-of-session protocol.
```

### Phase 2: pilot (write each prompt in full here before running it)

| Prompt | Scope |
| --- | --- |
| 9 | Real NHIA directory for Greater Accra (written in full below) |
| 10 | Real staff sign-in (email and password, accounts made by an admin), admin side, design pass on admin and patient screens |
| 10c | Look and copy polish across patients, hospital staff, insurers and admin (written in full below) |
| 11 | Screen 15, hospital onboarding, plus SMS morning-check reminders |
| 12 | Screen 8, map view with Leaflet and OpenStreetMap |
| 13 | Screens 9 and 10: saved hospitals, alerts, sharing |
| 14 | Screen 12: full offline and low-data mode |
| 15 | Live SMS and USSD through the chosen aggregator |
| 16 | Screen 19: insurer list upload, matching and conflicts |
| 17 | Languages (Twi, Ga, Ewe, Dagbani, Hausa), privacy notice, pilot analytics |

**Prompt 9: real NHIA directory for Greater Accra**

```text
Start-of-session protocol first. Then build Prompt 9 from SPEC.md: real NHIA directory for Greater Accra.

1. Import: read the NHIA accredited-provider file in data/nhia/ and its SOURCE.md. Write a tested
   importer (lib/import/nhia.ts) that keeps name, type, district, area, phone (only if the file has
   one) and the NHIA code. Never invent or fill in a fact the file doesn't have. Rows the importer
   can't read go to a report, not the database.
2. Locations: match each facility to OpenStreetMap by name and district (credit OpenStreetMap,
   ODbL). Store location_source = osm only for a confident match; otherwise none, and list it on
   /admin under "Needs a location". An admin can set it by hand (location_source = admin).
3. Facts allowed for real facilities: facility_insurers row for NHIS with listed_by = nhia (badge B4),
   nothing for private insurers (B5), no status rows, no reports, no top-ups, no hospital answers.
   Write a test that fails if any real facility has an invented report, status or hospital answer.
4. Rules D1–D3, the S2 addition and the F until_time change in lib/rules with tests first, citing
   rule ids. Show the source line ("From the NHIA list, {month year}") on results, hospital and
   emergency screens.
5. Demo mode: demo hospitals (source = demo) show only when the demo login cookie or ?demo=1 is
   set. Keep tests/e2e/demo.spec.ts passing in demo mode, and "Reset demo data" working.
6. SAMPLE DATA: show the tag only while a demo hospital is on the screen (rule 1 as changed).
   Test both cases.
7. Reports: rule R1 (REPORTS_LIVE=off closes reports on real hospitals, web and USSD). Test it.
8. Results: a Call button on "Call first" cards (restructure the card so the link and the button
   aren't nested). Insurer table at 390 px: stacked rows.
9. Check on the live site: a search near Dansoman shows real NHIA facilities with the source line,
   no SAMPLE DATA tag, and no fact without a source.
Do not touch auth, admin verification of hospitals or USSD going live: those are later prompts.
End-of-session protocol.
```

**Prompt 10: real staff sign-in, the admin side, and a top-notch patient side**

```text
Start-of-session protocol first. Then build Prompt 10 from SPEC.md: real staff sign-in, a complete
admin side, and a design pass that makes Veriq look and feel like a finished product.

Design goal for this prompt and every one after it: real, professional, minimal and outstanding.
Calm and confident, never busy. One clear action per screen, generous white space, a strict type
scale, and colour used for meaning (badges, status), not decoration. It must feel trustworthy to a
patient on a cheap Android phone and efficient to an admin on a laptop. Rules 4, 7 and 9 still
win over looks: every fact keeps its source, targets stay at least 44 px, words stay plain.

1. Design system first: one set of tokens in app/globals.css (colour roles, type scale, spacing,
   radius, shadow, motion) and a small set of shared components (button, card, list row, badge,
   status line, empty state, toast, dialog, form field with error). Every screen touched in this
   prompt uses them. Record the choices in docs/DESIGN.md with a one-page visual sample.
2. Sign-in without any outside messaging: Supabase Auth with email and password. No email or SMS is
   sent by Veriq or Supabase. An admin creates staff accounts in the app (Supabase admin API with
   the service role, email already confirmed) and gives the person a one-time password by hand;
   on first sign-in the person must set their own password. An admin can reset a password the same
   way. Roles come from profiles (admin, hospital, insurer) and the row-level security already in
   the migrations. The first admin is created by a one-off script (npm run create-admin) that
   reads an email from the command line, never from a migration. Messaging stays behind
   lib/messaging (console stub), so email codes or SMS can be added later without changing screens.
   The demo login stays for rehearsals and tests only, and is off on the real site (DEMO_LOGIN=off).
3. Admin home (/admin): a calm overview with to-do counts (facilities needing a location, hospitals
   waiting for verification, held reports), each opening its list. Works at 390 px and uses the
   width well on a laptop (side navigation, wider tables). Every list shows its source and time
   (rule 4).
4. Staff accounts (/admin/staff): list, create, disable, reset password; link a hospital account to
   its facility and an insurer account to its insurer.
5. Verify hospitals: an admin checks a hospital's claim (name against the NHIA list, call back on a
   known number) and marks it verified, with who and when. Only a verified hospital's staff can
   publish a morning check or hospital answers. Every admin action (who, what, when, why) goes in
   an append-only admin_actions table, shown as a history on each hospital.
6. Held reports (rule A): list reports held by the burst rule; release or reject each with a
   reason, after a confirmation. A released report counts from then on; a rejected one never does.
7. Needs a location: keep the Prompt 9 list; add search by name or district, and a map preview of
   the typed point (OpenStreetMap tiles, credited) before saving.
8. Patient side, top notch: a design pass on First open, Find, Results, Hospital, Report, Thanks,
   Emergency, Cards and Help with the new tokens and components: the answer first, tidy cards,
   consistent spacing, polished empty and loading states, subtle motion that respects
   reduced-motion settings. No new features and no removed facts or source lines.
9. Proof: screenshots before and after of every touched screen at 390 px, plus the admin screens at
   1280 px, in docs/sessions/. axe (WCAG 2.1 AA) and the 44 px check pass on every screen, and
   first content stays under 3 s on 3G.
10. Real staff sign-in (email and password, accounts made by an admin), admin side, design pass on admin and patient screens.
11. Morning check (rule F): verified hospital staff can set an optional "till" time per service
    (e.g. open till 4 pm), saved as until_time; after it passes, patients see "Was {status} till
    {time}. Call to check". Test it.
Do not touch USSD going live, SMS or email sending, insurer list upload or the map view: those are
later prompts.
End-of-session protocol.
```

**Prompt 10c: look and copy polish**

```text
Start-of-session protocol first. This prompt is about how the app LOOKS and READS. Do not change any
rule, data, privacy behaviour or feature.

Goal: a calm, professional, minimal app that looks like a finished product from a serious health
company, across all four sides: patients, hospital staff, insurers and admin. Standard patterns,
nothing clever. Less text, more clarity.

Step 1: Audit (don't skip)
- Screenshot every built screen BEFORE changes: patient screens at 390x844, staff/insurer/admin at
  1280x800, in demo mode. Save to docs/polish/before/.
- List every piece of on-screen text longer than one line, every repeated message, and every place
  two components do the same job in different styles.

Step 2: Design system (update docs/DESIGN.md and the Tailwind tokens)
- Type: Plus Jakarta Sans only. Four sizes: page title, section title, body, small. Weights 400,
  600, 700. Tabular numbers for all figures.
- Colour: green (#0B6E4F) for primary actions and "confirmed"; neutrals for everything else; orange
  only for refusals and warnings; red only for emergency. No other colours, no gradients.
- Spacing on an 8px grid; 16px page gutter on phones; one card style (white, hairline border, 12px
  radius, no heavy shadow); one badge style; one list-row style; buttons in three kinds only
  (primary, secondary, text).
- One icon set, one stroke width, used sparingly.
- Every state designed: loading (skeletons), empty (icon + one line + one action), error (one line +
  retry), offline.

Step 3: Copy: cut hard
- Default to no helper text. Keep one short line only where a user would otherwise get stuck.
- Labels: 1-3 words. Buttons: verbs ("Search", "Call", "Publish").
- Shorten sources but never remove them. Every fact still shows who said it and when, compactly,
  e.g. "Hospital · 40 min ago", "Patients · 14 this month", "NHIA list".
- Move all explanations to /how-we-check and link to it with one small "How we check" link.
- Exactly one SAMPLE DATA tag per screen in demo mode: small, consistent, in the same place. Never
  remove it.
- Remove duplicate notices, repeated reassurance lines and "coming soon" text from the main flows.
- Keep: 112 and 193 first in emergency mode; "the card never hides a hospital" (one short line);
  the privacy line on the report form (one line).

Step 4: Apply across every side
- Patients (phone): clean header, one clear primary action per screen, sticky bottom action where
  useful, consistent result cards (name, distance, badge, one status line), hospital page in clear
  sections (Your card, Today, Other cards, Report).
- Hospital staff: an app shell with the hospital name and a simple nav. The morning check is a clean
  form: one row per service with a segmented control, a single "Publish" button, and a success state
  that says what changed.
- Insurers: a dashboard shell with sidebar nav and a page header. KPI tiles of equal height with the
  number first. Tables with aligned columns, right-aligned numbers, clear empty states. Disabled
  placeholders hidden, not shown.
- Admin: the same shell as insurers, with a consistent page header (title + primary action), filter
  bar, tables, row actions in one place, and confirmation dialogs for destructive actions.
- Staff sign-in: a centred card, logo, two fields, one button. Nothing else.
- Desktop widths: content max ~1200px. Phone: no sideways scroll.

Rules
- Accessibility stays WCAG 2.1 AA, with 44px touch targets. All existing tests must pass. Update e2e
  selectors only where wording changed, keeping what each test checks. Prefer roles and test ids
  over visible text.
- 3G first content must stay under 1 second on the live site. No new heavy libraries.
- No new features. If you find a bug, list it; don't fix it here unless it's one line.

Report
- AFTER screenshots of every screen at the same sizes in docs/polish/after/, plus a side-by-side
  contact sheet (docs/polish/compare.png).
- A table of every copy change: screen, old text, new text.
- Test counts, lint, typecheck and 3G numbers.
If this is too big for one session, finish the design system and the patient screens first, then
wrap up and continue in the next session.

Don't push or apply migrations; give me the commands. End-of-session protocol.
```


### Phase 3: scale (outline only)

18: screen 17, the national bed-system link, built only after a signed agreement. 19: regions beyond Greater Accra. 20: insurer data feed (API) and paid plans.

## 9. Demo script and definition of done

**The 90-second demo is the Phase 1 acceptance test: Prompt 8 turns it into `tests/e2e/demo.spec.ts`, and we rehearse it by hand.**

1. Open the app on a phone and tap through the first-open screen.
2. Choose Antenatal / maternity and NHIS, near Dansoman. Tap "Show hospitals that take NHIS".
3. Results show Akoma (hospital confirmed), Lakeside (patients confirmed), Gbawe (not checked) and Pinecrest last (refused). Say: "Pinecrest is on the official NHIS list. Patients say otherwise."
4. Open Akoma: today's status with times, cards with sources, the GH¢ 80 scan top-up.
5. Tap "Been here?", choose "Yes, but I paid extra", then Send. The thank-you screen shows what changed.
6. Switch to the hospital demo login: mark the antenatal clinic Closed and publish. Back on Results, Akoma now shows Closed.
7. Open emergency mode: 112 and 193, units sorted by status and distance, the card shown but not filtering.
8. Finish on the insurer view: "Members were refused 23 times at 6 hospitals this month. That's who pays us."

**Phase 1 is done when:**

- [ ] The demo script passes as a Playwright test and by hand on a mid-range Android phone
- [ ] Every rule in section 4 has passing unit tests, including the threshold cases
- [ ] Lint and type-check pass with no errors
- [ ] Every data screen shows SAMPLE DATA, and no real hospital names appear anywhere
- [ ] No card number or personal data reaches the server (tested)
- [ ] Emergency results never change with the card (tested)
- [ ] The deployed URL loads first content in under 3 seconds on throttled 3G
- [ ] `PROGRESS.md` shows Prompts 0–8 done, with a session report for each
- [ ] "Reset demo data" restores the demo state in one click
