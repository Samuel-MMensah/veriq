// @vitest-environment node
// Prompt 9, item 3: real facilities carry only directory facts (rules D1 and D2). This test fails if
// any real facility has an invented report, status, service, top-up or hospital answer, a private
// insurer row, or a fact that isn't in the NHIA file. It runs the real migrations, the generated
// directory migration and the demo seed in PGlite.
// Prompt 10b, item 3: a real facility may now also hold facts from a Veriq verification call (card
// answers, phone, services, hours, location), each backed by a saved call. Still no invented status,
// report or top-up.
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
  // Services only from a Veriq call that named them (Prompt 10b).
  expect(
    await count(`select count(*)::int n from public.facility_services s where facility_id in (${real})
                 and not (s.source = 'veriq_call' and exists (select 1 from public.verification_calls c
                          where c.facility_id = s.facility_id and s.service_id = any (c.services) and c.called_at = s.checked_at))`),
  ).toBe(0);
  // A phone only when the file has one or a Veriq call reached it.
  expect(
    await count(`select count(*)::int n from public.facilities f where source = 'nhia' and phone is not null
                 and not (phone_source = 'veriq_call' and exists (select 1 from public.verification_calls c
                          where c.facility_id = f.id and c.phone_reached = f.phone and c.called_at = f.phone_checked_at))`),
  ).toBe(0);
  expect(await count(`select count(*)::int n from public.reach_daily where facility_id in (${real})`)).toBe(0);
  // Rule B4: one NHIS row each, listed by NHIA, with no hospital answer. Any other row (a private card,
  // listed_by = none) exists only for a Veriq call's answer (rule B-V). Never a hospital answer.
  expect(
    await count(`select count(*)::int n from public.facility_insurers where facility_id in (${real})
                 and (hospital_says is not null or hospital_confirmed_at is not null
                      or not ((insurer_id = '${NHIS}' and listed_by = 'nhia') or (listed_by = 'none' and call_says is not null)))`),
  ).toBe(0);
  // Every call answer on a card row is a saved call's answer, at that call's time.
  expect(
    await count(`select count(*)::int n from public.facility_insurers l where facility_id in (${real}) and call_says is not null
                 and not exists (select 1 from public.verification_calls c join public.verification_call_answers a on a.call_id = c.id
                                 where c.facility_id = l.facility_id and a.insurer_id = l.insurer_id
                                   and a.answer = l.call_says and c.called_at = l.call_at)`),
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

  it("a Veriq call's facts are allowed, and nothing else is (Prompt 10b, item 3)", async () => {
    const [f] = await rows<{ id: string }>("select id from public.facilities where source = 'nhia' and location_source = 'none' limit 1");
    await db.exec("begin");
    try {
      await db.query("select public.record_verification_call($1)", [
        {
          facility_id: f!.id,
          called_at: "2026-10-28T09:00:00Z",
          caller_label: "ama@veriq.org",
          answered_role: "Front desk",
          phone_reached: "0302221234",
          services: ["gp"],
          usual_hours: "8 am to 5 pm",
          lat: 5.56,
          lng: -0.25,
          answers: [
            { insurer_id: NHIS, answer: "accepts", note: null },
            { insurer_id: "a0000000-0000-4000-8000-000000000002", answer: "partial", note: "top-up for scans" },
          ],
          actor_label: "ama@veriq.org",
        },
      ]);
      await expectNoInventedFacts();
      // A service no call named is still caught.
      await db.query("insert into public.facility_services (facility_id, service_id, source, checked_at) values ($1, 'lab', 'veriq_call', now())", [f!.id]);
      await expect(expectNoInventedFacts()).rejects.toThrow();
    } finally {
      await db.exec("rollback");
    }
  });

  it("the check catches a hospital answer, or a card answer with no call behind it", async () => {
    const [f] = await rows<{ id: string }>("select id from public.facilities where source = 'nhia' limit 1");
    for (const sql of [
      "update public.facility_insurers set hospital_says = 'accepts', hospital_confirmed_at = now() where facility_id = $1",
      "update public.facility_insurers set call_says = 'accepts', call_at = now() where facility_id = $1",
    ]) {
      await db.exec("begin");
      try {
        await db.query(sql, [f!.id]);
        await expect(expectNoInventedFacts()).rejects.toThrow();
      } finally {
        await db.exec("rollback");
      }
    }
  });

  it("the invented insurers (Sika Health, Adom Care) are demo-only, and nothing real links to them (rule D2)", async () => {
    const SIKA = "a0000000-0000-4000-8000-000000000004";
    const demoCards = (await rows<{ slug: string }>("select slug from public.insurers where is_sample order by slug")).map((r) => r.slug);
    expect(demoCards).toEqual(["adom-care", "sika-health"]);
    const real = "select id from public.facilities where source = 'nhia'";
    const demoIns = "select id from public.insurers where is_sample";
    for (const table of ["facility_insurers", "card_reports", "hospital_responses"]) {
      expect(await count(`select count(*)::int n from public.${table} where facility_id in (${real}) and insurer_id in (${demoIns})`), table).toBe(0);
    }
    expect(await count(`select count(*)::int n from public.verification_call_answers where insurer_id in (${demoIns})`)).toBe(0);
    expect(await count(`select count(*)::int n from public.profiles where insurer_id in (${demoIns})`)).toBe(0);

    // "Reset demo data" puts them back still marked as demo.
    await db.exec("select public.reset_demo()");
    expect(await count("select count(*)::int n from public.insurers where is_sample")).toBe(2);

    // The database refuses to tie a demo card to a real facility, a call or a staff account.
    const [f] = await rows<{ id: string }>(`${real} limit 1`);
    await expect(db.query("insert into public.facility_insurers (facility_id, insurer_id, listed_by) values ($1, $2, 'none')", [f!.id, SIKA])).rejects.toThrow(
      /demo insurers are for demo facilities only/,
    );
    await expect(
      db.query("select public.record_verification_call($1)", [
        {
          facility_id: f!.id,
          called_at: "2026-10-28T09:00:00Z",
          caller_label: "ama@veriq.org",
          answered_role: "Front desk",
          phone_reached: "0302221234",
          answers: [{ insurer_id: SIKA, answer: "accepts", note: null }],
          actor_label: "ama@veriq.org",
        },
      ]),
    ).rejects.toThrow(/never asked about on a real call/);
    await db.exec("begin");
    try {
      const [u] = await rows<{ id: string }>("insert into auth.users (email) values ('x@sika.test') returning id");
      await expect(db.query("insert into public.profiles (user_id, role, insurer_id) values ($1, 'insurer', $2)", [u!.id, SIKA])).rejects.toThrow(
        /never linked to a demo insurer/,
      );
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
