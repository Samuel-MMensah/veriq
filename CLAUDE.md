# Veriq Health: standing rules for Claude Code

`SPEC.md` is the single source of truth. If code and spec disagree, the spec wins. Never edit `SPEC.md`.
Build only the scope of the prompt pasted in this session. One prompt per session.

## Non-negotiable rules (SPEC section 1)

1. **Sample data only until Phase 2.** Every screen with data shows a "SAMPLE DATA" tag. Use invented hospital names only; never real hospitals in seed data.
2. **Never store patient identity.** No names or card numbers on the server. Saved cards live in the browser (IndexedDB). Reports carry only a random device ID and a hash.
3. **The card never hides a hospital in emergency mode.** Emergency results sort by status and distance only.
4. **Every fact has a source and a timestamp**, and the screen says which. No unsourced "available".
5. **Money never changes a badge or a ranking.** No code path may read a payment or plan field in badge or sort logic.
6. **Rules, not AI.** Badges, sorting and top-ups are plain, tested functions in `lib/rules/`.
7. **Mobile first.** Design at 390 px wide; touch targets at least 44 px; it must work on a cheap Android phone over 3G.
8. **Offline-tolerant.** The last search area is cached; reports queue and send when back online.
9. **Plain words.** Short sentences, no medical jargon, Ghana cedi shown as GH¢.

Out of scope in all phases: appointment booking, patient payments, medical records, telemedicine, ambulance dispatch, AI symptom checking, native app-store apps (until after the pilot).

## Business rule ids (SPEC section 4)

- **B** card badge: B1 reported refused, B2 hospital confirmed, B2x hospital says no, B3 patients confirmed, B4 on a list not checked, B5 unknown
- **F** status freshness
- **T** top-ups
- **S1** results order, **S2** emergency order
- **A** report limits
- **K** insurer figures
- **M** morning check

All rules live in `lib/rules/` as pure functions that take `now` as an argument, with unit tests.
**Code comments and tests must cite the rule id they implement** (for example `// rule B1`).

## Phase gates (SPEC section 6)

A phase is finished only when its gate passes. Do not start the next phase's work early, even when it seems quick.

| Phase | Prompts | Gate (all must be true) |
| --- | --- | --- |
| 1. Pitch demo | 0–8 | Demo script (section 9) passes as a Playwright test and by hand on a phone; all rule tests pass; deployed URL works on 3G throttling; every data screen shows SAMPLE DATA |
| 2. Pilot | 9–16 | Data Protection Commission registration done; real hospital logins; reports pass rule A in production; USSD works through an aggregator; admin can verify hospitals |
| 3. Scale | 17+ | Signed data-sharing agreement with GHS and NAS before any national-link code goes live |

## Session protocol (SPEC section 7, word for word)

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

**Never start the next prompt yourself.**

If told "Wrap up now: write the session report and update PROGRESS.md.", stop work and do the end steps; the next session continues the same prompt.

When making a choice the spec didn't, add one line to `docs/DECISIONS.md`: date, decision, reason.

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
