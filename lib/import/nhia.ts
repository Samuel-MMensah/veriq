// Prompt 9: reads the NHIA accredited-provider file (data/nhia/, see its SOURCE.md) into facility rows.
// Rule D1: a real facility carries only what the file says. Nothing is filled in or guessed: no
// phone or NHIA code unless the file has that column, no ownership type, no services. Rows the
// importer can't read go to the report, never to the database.
// Imports use .ts extensions so `node scripts/import-nhia.ts` runs without a build step.
import { parseCsv } from "./csv.ts";

export type NhiaFacility = {
  /**
   * SPEC section 3: the code in the source file ("NHIA {code}") when the file has one, otherwise the
   * row, "{file}#row-{n}" (n counts data rows from 1).
   */
  source_ref: string;
  name: string;
  /** As the file writes it, e.g. "PRIMARY HOSPITAL", "Pharmacy", "POLY2005". */
  nhia_type: string;
  /** As the file writes it, e.g. "ABLEKUMA". */
  district: string;
  /** The file's Location column, or null when it is blank. */
  area: string | null;
  /** Only when the file has a phone column. */
  phone: string | null;
};

export type RejectedRow = { row: number; reason: string; raw: string[] };

export type NhiaImport = { facilities: NhiaFacility[]; rejected: RejectedRow[] };

// Column names as the NHIA provider page shows them. Phone and code are optional: the Greater
// Accra page (October 2026) has neither.
const REQUIRED = ["District", "Provider Name", "Provider Type", "Location"] as const;
const OPTIONAL_PHONE = ["Phone", "Phone Number", "Telephone"];
const OPTIONAL_CODE = ["NHIA Code", "Provider Code", "Code", "Accreditation Number"];

const clean = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** A type the file writes in words. "5 B2" (one Osu row) is not a type we can read. */
const READABLE_TYPE = /^[A-Za-z][A-Za-z0-9 /&()-]*$/;

/** Same name and district, ignoring case and punctuation: the file lists the same facility twice. */
const dedupeKey = (name: string, district: string) =>
  `${district}|${name}`.toUpperCase().replace(/[^A-Z0-9|]+/g, " ").trim();

export function parseNhiaCsv(text: string, sourceFile: string): NhiaImport {
  const [header, ...body] = parseCsv(text);
  if (!header) throw new Error(`${sourceFile} is empty.`);
  const cols = header.map(clean);
  const missing = REQUIRED.filter((c) => !cols.includes(c));
  if (missing.length) throw new Error(`${sourceFile} has no ${missing.join(", ")} column. Is it the NHIA provider list?`);

  const at = (name: string) => cols.indexOf(name);
  const phoneCol = cols.findIndex((c) => OPTIONAL_PHONE.includes(c));
  const codeCol = cols.findIndex((c) => OPTIONAL_CODE.includes(c));

  const facilities: NhiaFacility[] = [];
  const rejected: RejectedRow[] = [];
  const seen = new Set<string>();

  body.forEach((raw, i) => {
    const row = i + 1;
    if (raw.every((cell) => clean(cell) === "")) return; // a blank line, not a row
    const reject = (reason: string) => rejected.push({ row, reason, raw });
    if (raw.length !== cols.length) return reject(`has ${raw.length} columns, the header has ${cols.length}`);

    const name = clean(raw[at("Provider Name")]);
    const district = clean(raw[at("District")]);
    const type = clean(raw[at("Provider Type")]);
    if (!name) return reject("no provider name");
    if (!district) return reject("no district");
    if (!type) return reject("no provider type");
    if (!READABLE_TYPE.test(type)) return reject(`provider type "${type}" is not one we can read`);

    const key = dedupeKey(name, district);
    if (seen.has(key)) return reject("the same name and district are listed earlier in the file");
    seen.add(key);

    const code = codeCol >= 0 ? clean(raw[codeCol]) : "";
    facilities.push({
      source_ref: code ? `NHIA ${code}` : `${sourceFile}#row-${row}`,
      name,
      nhia_type: type,
      district,
      area: clean(raw[at("Location")]) || null,
      phone: phoneCol >= 0 ? clean(raw[phoneCol]) || null : null,
    });
  });

  return { facilities, rejected };
}
