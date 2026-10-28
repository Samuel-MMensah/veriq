# Verification calls (Prompt 10b)

The Veriq team phones real facilities and records what each says about every card (rule B-V). No patient data is involved.

| File | What it is |
| --- | --- |
| [call-script.md](call-script.md) | One-page script: greeting, who we are, the questions per card, a polite close |
| [calls-template.csv](calls-template.csv) | Blank sheet for calls made on paper. Same columns as the import at **/admin/calls/import** (also downloadable there) |
| This page | The first 30 facilities to call |

## Filling in the CSV

| Column | What to write |
| --- | --- |
| `called_at` | Date and time of the call, Accra time: `2026-10-29 10:15` |
| `facility_ref` | The facility's source row, from the list below or /admin/calls/new: `greater-accra-2026-10-26.csv#row-17` |
| `facility_name` | Optional check. If given, it must match the name for that row |
| `caller_email` | Email of the admin account that made the call |
| `answered_role` | Role only, never a name: `Front desk` |
| `phone_reached` | The number you reached: `030 222 1234` |
| `nhis`, `adom-care`, `cosmopolitan`, `prudential`, `sika-health` | `accepts`, `does_not`, `partial` or `not_asked` (blank means not asked) |
| `{card}_note` | Needed for `partial`, e.g. `top-up for scans`; 120 characters at most |
| `services` | Optional, separated by `;`: `antenatal;lab;gp`. Ids: antenatal, delivery, c_section, emergency, ultrasound, xray, ct, lab, gp, paediatrics, dental, obstetrician |
| `usual_hours` | Optional: `Mon–Sat 8 am to 5 pm` |
| `location` | Optional, in quotes: `"5.5612, -0.2601"` |

The import shows a preview first and saves nothing until every row is clean and you confirm. A call already saved (same facility and time) is skipped, never counted twice.

## The first 30 facilities to call

**Source:** our NHIA Greater Accra list (October 2026), without pharmacies, chemical shops, labs or scan-only centres.

**Spread:**
- 14 hospitals, 6 polyclinics, 6 clinics and 4 others (2 maternity homes, a health centre and a CHPS compound);
- 20 already have a map location; the other 10 can get one on the call.

**Kasoa:** Kasoa is in Central Region, outside the Greater Accra list, so the four nearest listed facilities are used instead, on the Weija–Gbawe–Kasoa road.

**Ownership:** the NHIA file doesn't say who owns a facility. The "Likely" column is a guess from the name only, to help get a mix; it is never stored. Ask on the call if it matters.

| # | Area | Facility | NHIA type | Likely | Map | facility_ref |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Dansoman | Dansoman Polyclinic | POLY2005 | Public | Yes | `greater-accra-2026-10-26.csv#row-17` |
| 2 | Dansoman | Nightingale Clinic | Clinic | Private | No | `greater-accra-2026-10-26.csv#row-42` |
| 3 | Dansoman | Mamprobi Poyclinic | POLY2005 | Public | No | `greater-accra-2026-10-26.csv#row-34` |
| 4 | Kaneshie | Kaneshie Polyclinic | POLY2005 | Public | Yes | `greater-accra-2026-10-26.csv#row-30` |
| 5 | Kaneshie | Cocoa Clinic | Primary hospital | Quasi-public | Yes | `greater-accra-2026-10-26.csv#row-291` |
| 6 | Kaneshie | Faith Evangelical Mission Hospital | Primary hospital | Mission | Yes | `greater-accra-2026-10-26.csv#row-294` |
| 7 | Kaneshie | Amoah Memorial Hospital (Awoshie) | Primary hospital | Private | Yes | `greater-accra-2026-10-26.csv#row-162` |
| 8 | Weija (Kasoa road) | Royal Good Shepherd Medical Centre | Primary hospital | Private | No | `greater-accra-2026-10-26.csv#row-227` |
| 9 | Gbawe (Kasoa road) | S D A Hospital | Health centre | Mission | No | `greater-accra-2026-10-26.csv#row-229` |
| 10 | Gbawe (Kasoa road) | Blossom Healthcare Maternity Home | Maternity | Private | No | `greater-accra-2026-10-26.csv#row-168` |
| 11 | Obom (Kasoa road) | Obom Health Centre | CHPS compound | Public | No | `greater-accra-2026-10-26.csv#row-213` |
| 12 | Madina | Madina Polyclinic | POLY2005 | Public | Yes | `greater-accra-2026-10-26.csv#row-202` |
| 13 | Madina | Pentecost Hospital Madina | Primary hospital | Mission | No | `greater-accra-2026-10-26.csv#row-223` |
| 14 | Madina | Esidem Hospital Madina | Primary hospital | Private | No | `greater-accra-2026-10-26.csv#row-92` |
| 15 | Madina | North Legon Hospital | Primary hospital | Private | Yes | `greater-accra-2026-10-26.csv#row-210` |
| 16 | Adenta | Adenta Clinic | Clinic | Private | Yes | `greater-accra-2026-10-26.csv#row-160` |
| 17 | Tema | Tema General Hospital | Secondary hospital | Public | Yes | `greater-accra-2026-10-26.csv#row-409` |
| 18 | Tema | Tema Polyclinic | POLY2005 | Public | Yes | `greater-accra-2026-10-26.csv#row-411` |
| 19 | Tema | Port Medical Centre | Primary hospital | Quasi-public | Yes | `greater-accra-2026-10-26.csv#row-395` |
| 20 | Tema | Bengali Hospital | Primary hospital | Private | Yes | `greater-accra-2026-10-26.csv#row-352` |
| 21 | Tema | Narh Bita Hospital | Primary hospital | Private | Yes | `greater-accra-2026-10-26.csv#row-384` |
| 22 | Tema | Maldey Medical Centre | Clinic | Private | Yes | `greater-accra-2026-10-26.csv#row-377` |
| 23 | Ashaiman | Afenyo Memorial Hospital | Primary hospital | Private | Yes | `greater-accra-2026-10-26.csv#row-346` |
| 24 | Ashaiman | St Florence Clinic | Clinic | Mission | Yes | `greater-accra-2026-10-26.csv#row-406` |
| 25 | Osu | Rabito Clinic | Clinic | Private | Yes | `greater-accra-2026-10-26.csv#row-332` |
| 26 | Osu | VRA Hospital Accra | Primary hospital | Quasi-public | No | `greater-accra-2026-10-26.csv#row-341` |
| 27 | Osu | Osu Govt Maternity Home | Maternity | Public | No | `greater-accra-2026-10-26.csv#row-329` |
| 28 | La | La General Hospital | Primary hospital | Public | Yes | `greater-accra-2026-10-26.csv#row-266` |
| 29 | Adabraka | Adabraka Polyclinic | POLY2005 | Public | Yes | `greater-accra-2026-10-26.csv#row-316` |
| 30 | Adabraka | Iran Clinic | Clinic | Private | Yes | `greater-accra-2026-10-26.csv#row-325` |

**"Likely" mix:** 13 public or quasi-public, 4 mission, 13 private.

**No phone numbers:** the NHIA file has none, so find each number before calling (the facility's sign, Google Maps, or a directory). The number you reach is then saved on the facility.
