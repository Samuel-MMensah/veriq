// Prompt 9: builds the real Greater Accra directory from data/nhia/.
//   node scripts/import-nhia.ts
// Reads the NHIA file and the OpenStreetMap extract named in data/nhia/SOURCE.md, then writes
//   - supabase/migrations/20261026000007_nhia_greater_accra.sql (the rows, for local mode and Supabase)
//   - data/nhia/import-report.md (rows it couldn't read, and facilities that need a location)
// The importer and matcher are tested in lib/import; this file only reads and writes files.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseNhiaCsv } from "../lib/import/nhia.ts";
import { matchAll, type OsmPlace } from "../lib/import/osm.ts";
import { importReport } from "../lib/import/report.ts";
import { directorySql } from "../lib/import/sql.ts";

export const SOURCE = {
  file: "greater-accra-2026-10-26.csv",
  taken: "2026-10-26",
  osmFile: "osm-health-greater-accra-2026-10-26.json",
};
export const MIGRATION = "supabase/migrations/20261026000007_nhia_greater_accra.sql";
export const REPORT = "data/nhia/import-report.md";

const root = process.cwd();
const csv = readFileSync(join(root, "data/nhia", SOURCE.file), "utf8");
const osm = JSON.parse(readFileSync(join(root, "data/nhia", SOURCE.osmFile), "utf8")) as { osm_base: string; places: OsmPlace[] };

const { facilities, rejected } = parseNhiaCsv(csv, SOURCE.file);
const matches = matchAll(facilities, osm.places);
const osmDate = osm.osm_base.slice(0, 10);

writeFileSync(join(root, MIGRATION), directorySql({ facilities, matches, sourceFile: SOURCE.file, sourceDate: SOURCE.taken, osmDate }));
writeFileSync(join(root, REPORT), importReport({ facilities, rejected, matches, sourceFile: SOURCE.file, osmDate }));

const located = matches.filter((m) => m.location_source === "osm").length;
console.log(`${facilities.length} facilities, ${rejected.length} rows not read, ${located} located on OpenStreetMap.`);
console.log(`Wrote ${MIGRATION} and ${REPORT}.`);
