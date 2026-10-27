// @vitest-environment node
// Prompt 9, item 3: real facilities carry only directory facts (rules D1 and D2). This test fails if
// any real facility has an invented report, status, service, top-up or hospital answer, a private
// insurer row, or a fact that isn't in the NHIA file. It runs the real migrations, the generated
// directory migration and the demo seed in PGlite.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseNhiaCsv } from "@/lib/import/nhia";
import { matchAll, type OsmPlace } from "@/lib/import/osm";
import { directorySql } from "@/lib/import/sql";
import { createDb } from "@/lib/db/pglite";

const SOURCE_FILE = "greater-accra-2026-10-26.csv";
const OSM_FILE = "osm-health-greater-accra-2026-10-26.json";
const MIGRATION = "supabase/migrations/20261026000007_nhia_greater_accra.sql";
const NHIS = "a0000000-0000-4000-8000-000000000001";

const csv = readFileSync(join(process.cwd(), "data/nhia", SOURCE_FILE), "utf8");
const osm = JSON.parse(readFileSync(join(process.cwd(), "data/nhia", OSM_FILE), "utf8")) as { osm_base: string; places: OsmPlace[] };
const parsed = parseNhiaCsv(csv, SOURCE_FILE);

let db: PGlite;

beforeAll(async () => {
  db = await createDb();
}, 60_000);

afterAll(async () => {
  await db?.close();
});

async function rows<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}
async function count(sql: string): Promise<number> {
  return (await rows<{ n: number }>(sql))[0]!.n;
}

/** Every check that a real facility has nothing invented. Run before and after "Reset demo data". */
async function expectNoInventedFacts() {
  const real = "select id from public.facilities where source = 'nhia'";
  expect(await count(`select count(*)::int n from public.status_updates where facility_id in (${real})`)).toBe(0);
  expect(await count(`select count(*)::int n from public.card_reports where facility_id in (${real})`)).toBe(0);
  expect(await count(`select count(*)::int n from public.hospital_responses where facility_id in (${real})`)).toBe(0);
  expect(await count(`select count(*)::int n from public.facility_services where facility_id in (${real})`)).toBe(0);
  expect(await count(`select count(*)::int n from public.reach_daily where facility_id in (${real})`)).toBe(0);
  // Rule B4 only: one NHIS row each, listed by NHIA, with no hospital answer. Nothing for private insurers (B5).
  expect(
    await count(`select count(*)::int n from public.facility_insurers where facility_id in (${real})
                 and (insurer_id <> '${NHIS}' or listed_by <> 'nhia' or hospital_says is not null or hospital_confirmed_at is not null)`),
  ).toBe(0);
  expect(await count(`select count(*)::int n from public.facilities f where source = 'nhia'
                      and not exists (select 1 from public.facility_insurers l where l.facility_id = f.id and l.insurer_id = '${NHIS}')`)).toBe(0);
  // No staff login for a real facility yet (Prompt 10).
  expect(await count(`select count(*)::int n from public.profiles where facility_id in (${real})`)).toBe(0);
}

describe("the NHIA directory (Prompt 9, rules D1 and D2)", () => {
  it("the committed migration is exactly what the importer writes (no hand edits)", () => {
    const sql = directorySql({
      facilities: parsed.facilities,
      matches: matchAll(parsed.facilities, osm.places),
      sourceFile: SOURCE_FILE,
      sourceDate: "2026-10-26",
      osmDate: osm.osm_base.slice(0, 10),
    });
    expect(readFileSync(join(process.cwd(), MIGRATION), "utf8")).toBe(sql);
  });

  it("loads every row the importer read, as real and not sample", async () => {
    const [r] = await rows<{ n: number; sample: number; dated: number }>(
      `select count(*)::int n, count(*) filter (where is_sample)::int sample,
              count(*) filter (where source_date = '2026-10-26')::int dated
       from public.facilities where source = 'nhia'`,
    );
    expect(r).toEqual({ n: parsed.facilities.length, sample: 0, dated: parsed.facilities.length });
    expect(parsed.facilities.length).toBeGreaterThan(400);
  });

  it("rows the importer couldn't read are not in the database", async () => {
    expect(parsed.rejected.length).toBeGreaterThan(0);
    const names = (await rows<{ name: string }>("select name from public.facilities where source = 'nhia'")).map((r) => r.name);
    expect(names).not.toContain("CASTLE CLINIC"); // its type "5 B2" can't be read
  });

  it("every directory fact is the file's own: name, type, district and area", async () => {
    const db_rows = await rows<{ source_ref: string; name: string; nhia_type: string; district: string; area: string | null }>(
      "select source_ref, name, nhia_type, district, area from public.facilities where source = 'nhia'",
    );
    const byRef = new Map(parsed.facilities.map((f) => [f.source_ref, f]));
    for (const r of db_rows) {
      const f = byRef.get(r.source_ref);
      expect(f, r.source_ref).toBeDefined();
      expect(r).toEqual({ source_ref: f!.source_ref, name: f!.name, nhia_type: f!.nhia_type, district: f!.district, area: f!.area });
    }
  });

  it("no fact the file doesn't have: no phone, no ownership type, nothing verified", async () => {
    expect(await count("select count(*)::int n from public.facilities where source = 'nhia' and phone is not null")).toBe(0);
    expect(await count("select count(*)::int n from public.facilities where source = 'nhia' and type is not null")).toBe(0);
    expect(await count("select count(*)::int n from public.facilities where source = 'nhia' and (verified or verified_at is not null)")).toBe(0);
  });

  it("a location is either from OpenStreetMap or none, never made up", async () => {
    const [r] = await rows<{ osm: number; none: number; other: number; bad: number }>(
      `select count(*) filter (where location_source = 'osm')::int osm,
              count(*) filter (where location_source = 'none')::int none,
              count(*) filter (where location_source not in ('osm', 'none'))::int other,
              count(*) filter (where (location_source = 'none') <> (lat is null))::int bad
       from public.facilities where source = 'nhia'`,
    );
    expect(r!.other).toBe(0);
    expect(r!.bad).toBe(0);
    expect(r!.osm).toBeGreaterThan(0);
    expect(r!.none).toBeGreaterThan(0);
  });

  it("has no invented report, status, service, top-up or hospital answer", async () => {
    await expectNoInventedFacts();
  });

  it("'Reset demo data' never touches real facilities", async () => {
    const before = await rows("select id, name, lat, lng, location_source from public.facilities where source = 'nhia' order by id");
    await db.exec("select public.reset_demo()");
    const after = await rows("select id, name, lat, lng, location_source from public.facilities where source = 'nhia' order by id");
    expect(after).toEqual(before);
    await expectNoInventedFacts();
  });

  it("the check catches an invented status row (so it can't pass by accident)", async () => {
    const [f] = await rows<{ id: string }>("select id from public.facilities where source = 'nhia' limit 1");
    await db.exec("begin");
    try {
      await db.query(
        "insert into public.services (id, name, category) values ('gp', 'See a doctor', 'doctor') on conflict do nothing",
      );
      await db.query("insert into public.status_updates (facility_id, service_id, status, source) values ($1, 'gp', 'open', 'admin')", [f!.id]);
      await expect(expectNoInventedFacts()).rejects.toThrow();
    } finally {
      await db.exec("rollback");
    }
  });

  it("an admin-set location survives a re-import", async () => {
    const [f] = await rows<{ id: string }>("select id from public.facilities where source = 'nhia' and location_source = 'none' limit 1");
    await db.query("update public.facilities set lat = 5.55, lng = -0.25, location_source = 'admin' where id = $1", [f!.id]);
    await db.exec(readFileSync(join(process.cwd(), MIGRATION), "utf8"));
    const [r] = await rows<{ lat: number; location_source: string }>("select lat, location_source from public.facilities where id = $1", [f!.id]);
    expect(r).toEqual({ lat: 5.55, location_source: "admin" });
    expect(await count("select count(*)::int n from public.facilities where source = 'nhia'")).toBe(parsed.facilities.length);
  });

  it("the database refuses a real facility without its source row, or a location with no source", async () => {
    await expect(
      db.query("insert into public.facilities (name, region, district, source, is_sample, location_source) values ('X', 'Greater Accra', 'GA', 'nhia', false, 'none')"),
    ).rejects.toThrow(/facilities_real_has_ref/);
    await expect(
      db.query(
        "insert into public.facilities (name, region, district, source, is_sample, source_ref, source_date, location_source, lat, lng) values ('X', 'Greater Accra', 'GA', 'nhia', false, 'x', '2026-10-26', 'none', 5.5, -0.2)",
      ),
    ).rejects.toThrow(/facilities_location_known/);
  });

  it("the demo seed's 'Open till 4 pm' is an until_time, or none after 19:00 (rule F)", async () => {
    const [r] = await rows<{ note: string | null; until_time: string | null }>(
      `select note, until_time::text from public.current_status
       where facility_id = 'f0000000-0000-4000-8000-000000000001' and service_id = 'antenatal'`,
    );
    expect(r!.note).toBeNull();
    expect(r!.until_time === null || /^(1[2-9]|20):00:00$/.test(r!.until_time)).toBe(true);
  });
});
