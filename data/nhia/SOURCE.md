# Source: NHIA accredited providers, Greater Accra

## The list

- **File:** `greater-accra-2026-10-26.csv` (419 rows, as fetched; not edited)
- **From:** National Health Insurance Authority, "Providers" page, https://nhis.gov.gh/providers, region "GREATER ACCRA REGION"
- **Taken:** 26 October 2026 (all 14 pages of 30). Screens say "From the NHIA list, October 2026" (rule D1).
- **How:** `python -I scripts/fetch/nhia_providers.py <folder>` sends the page's own region and pager postbacks. No login.
- **Columns:** District, Provider Name, Provider Type, Location. There is **no phone column and no NHIA code**, so real facilities have neither (rule D1). `source_ref` is the row: `greater-accra-2026-10-26.csv#row-{n}`.
- **The page shows no date.** Its district names are the old ones (Ablekuma, Kpeshie, Ga, Dangme West, from before the 2012 and 2018 splits), so the list itself may be years old. The month on screen is the month we took it, not when NHIA last updated it.
- **It is not complete.** Several large Accra hospitals (for example Korle Bu Teaching Hospital and Ridge) are not on this page.
- **Licence:** the page states none. It is published by a public body for the public. **Ask NHIA for written permission to republish it before the pilot.**

## Rows we did not import

See `import-report.md` (made by `node scripts/import-nhia.ts`). In this file: one duplicate (Unicom Chemist Ltd, Ablekuma) and one row whose type reads "5 B2" (Castle Clinic, Osu Klottey).

## Locations

- **File:** `osm-health-greater-accra-2026-10-26.json`: 979 named health places (hospital, clinic, doctors, pharmacy, dentist, any `healthcare=*`) in the box 5.45 to 6.15 N, 0.55 W to 0.75 E, trimmed to id, name and position.
- **From:** OpenStreetMap via the Overpass API (`scripts/fetch/osm_health.py`), data as of 2026-10-26T08:48Z.
- **Licence:** © OpenStreetMap contributors, Open Database License (ODbL) 1.0, https://www.openstreetmap.org/copyright. Credited on the hospital page and on /admin.
- **Matching** (`lib/import/osm.ts`): the same name (case, punctuation, LTD and CENTER/CENTRE ignored), inside the facility's old district (a generous box per district), and only one such place. Names made only of general words ("Diagnostic Centre") are never matched. Anything less is `location_source = none` and is listed on /admin under "Needs a location".
- **Result:** 57 of 417 facilities located. The rest need a location set by hand (`location_source = admin`).

## Updating

1. Fetch a new list into a new dated file. Never edit a fetched file by hand.
2. Point `SOURCE` in `scripts/import-nhia.ts` at it, run `node scripts/import-nhia.ts`, and commit the new migration it writes (a new file name for a new list).
3. A re-import never overwrites a location an admin set.
