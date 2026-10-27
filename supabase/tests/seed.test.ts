// @vitest-environment node
// Checks the migrations and seed (Prompt 2). Badge logic itself is tested in lib/rules (Prompt 3);
// here we check that the seed holds the facts each badge, freshness state and figure needs.
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createDb, seedSql } from "@/lib/db/pglite";
import { demoUntilTime } from "@/lib/rules/demo-time";

const id = (n: number) => `f0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const F = {
  akoma: id(1), lakeside: id(2), gbawe: id(3), pinecrest: id(4), westhills: id(5), royalpalm: id(6),
  glefe: id(7), sunrise: id(8), unity: id(9), mercy: id(10), littlesteps: id(11), greenfield: id(12),
  labadi: id(13), harbourview: id(14), madina: id(15), ashaiman: id(16), amasaman: id(17), teshie: id(18),
};
const NHIS = "a0000000-0000-4000-8000-000000000001";
const DANSOMAN = { lat: 5.545, lng: -0.265 };

let db: PGlite;

beforeAll(async () => {
  db = await createDb();
  // Test-only distance helper; the real haversine lives in lib/geo.ts (Prompt 3).
  await db.exec(`
    create function pg_temp.km(lat1 float8, lng1 float8, lat2 float8, lng2 float8) returns float8
    language sql immutable as $$
      select 2 * 6371 * asin(sqrt(power(sin(radians(lat2 - lat1) / 2), 2)
        + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
    $$;
  `);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

async function rows<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const [row] = await rows<T>(sql, params);
  if (!row) throw new Error(`No row for: ${sql}`);
  return row;
}

/** The facts rule B reads for one facility and insurer, over the last 30 days of live reports. */
type BadgeFacts = {
  listed_by: string | null;
  hospital_says: string | null;
  confirmed_days: number | null;
  accepted: number;
  refused: number;
  refused_after_confirm: number;
};

async function badgeFacts(facilityId: string, insurerSlug: string): Promise<BadgeFacts> {
  return one<BadgeFacts>(
    `select fi.listed_by, fi.hospital_says,
            extract(day from now() - fi.hospital_confirmed_at)::int as confirmed_days,
            count(r.*) filter (where r.outcome in ('covered', 'topup'))::int as accepted,
            count(r.*) filter (where r.outcome = 'refused')::int as refused,
            count(r.*) filter (where r.outcome = 'refused'
              and (fi.hospital_confirmed_at is null or r.created_at > fi.hospital_confirmed_at))::int as refused_after_confirm
     from public.insurers i
     left join public.facility_insurers fi on fi.insurer_id = i.id and fi.facility_id = $1
     left join public.card_reports r on r.insurer_id = i.id and r.facility_id = $1
       and r.state = 'live' and r.created_at > now() - interval '30 days'
     where i.slug = $2
     group by fi.listed_by, fi.hospital_says, fi.hospital_confirmed_at`,
    [facilityId, insurerSlug],
  );
}

// Rule 1 as changed (Prompt 9): demo hospitals are invented and source = demo; the real NHIA list
// sits beside them (source = nhia, checked in supabase/tests/directory.test.ts).
describe("sample data (rule 1)", () => {
  it("has 18 demo facilities, all sample, all in Greater Accra", async () => {
    const r = await one<{ n: number; sample: number; accra: number }>(
      `select count(*)::int n, count(*) filter (where is_sample)::int sample,
              count(*) filter (where region = 'Greater Accra')::int accra from public.facilities where source = 'demo'`,
    );
    expect(r).toEqual({ n: 18, sample: 18, accra: 18 });
  });

  it("uses no well-known real hospital names", async () => {
    const real = [
      "korle bu", "ridge", "37 military", "lekma", "nyaho", "lister", "trust hospital", "holy trinity",
      "tema general", "pentecost hospital", "ussher", "princess marie louise", "la general", "police hospital",
      "achimota hospital", "mamprobi polyclinic", "kaneshie polyclinic", "weija gbawe municipal",
    ];
    const names = (await rows<{ name: string }>("select name from public.facilities where source = 'demo'")).map((r) => r.name.toLowerCase());
    for (const name of names) for (const r of real) expect(name).not.toContain(r);
  });

  it("has the four demo hospitals by name", async () => {
    const names = (await rows<{ name: string }>("select name from public.facilities")).map((r) => r.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "Akoma Mission Hospital", "Lakeside Family Clinic", "Gbawe Community Clinic", "Pinecrest Specialist Hospital",
      ]),
    );
  });

  it("stores no card numbers or names in reports (rule 2)", async () => {
    const cols = (
      await rows<{ column_name: string }>(
        "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'card_reports'",
      )
    ).map((c) => c.column_name);
    expect(cols).not.toEqual(expect.arrayContaining(["name"]));
    for (const c of cols) expect(c).not.toMatch(/card_number|patient|phone|ip/);
  });
});

describe("every badge appears (rule B)", () => {
  it("B1: Pinecrest/NHIS has 3 refusals after the hospital's answer, more refused than accepted", async () => {
    const f = await badgeFacts(F.pinecrest, "nhis");
    expect(f.listed_by).toBe("nhia");
    expect(f.refused_after_confirm).toBe(3);
    expect(f.refused).toBeGreaterThan(f.accepted);
  });

  it("B2: Akoma/NHIS confirmed by the hospital 2 days ago, with no refusals", async () => {
    const f = await badgeFacts(F.akoma, "nhis");
    expect(f).toMatchObject({ hospital_says: "accepts", confirmed_days: 2, refused_after_confirm: 0, accepted: 9 });
  });

  it("B2 with top-ups: Royal Palm/Cosmopolitan is partial within 14 days", async () => {
    const f = await badgeFacts(F.royalpalm, "cosmopolitan");
    expect(f.hospital_says).toBe("partial");
    expect(f.confirmed_days).toBeLessThanOrEqual(14);
  });

  it("B2x: Royal Palm/NHIS hospital says no within 14 days", async () => {
    const f = await badgeFacts(F.royalpalm, "nhis");
    expect(f.hospital_says).toBe("does_not");
    expect(f.confirmed_days).toBeLessThanOrEqual(14);
  });

  it("B3: Lakeside/NHIS has 14 patients confirmed and no hospital answer", async () => {
    const f = await badgeFacts(F.lakeside, "nhis");
    expect(f).toMatchObject({ hospital_says: null, accepted: 14, refused: 0 });
  });

  it("B3 at the threshold: Little Steps/NHIS has exactly 3 accepted", async () => {
    const f = await badgeFacts(F.littlesteps, "nhis");
    expect(f).toMatchObject({ hospital_says: null, accepted: 3, refused: 0 });
  });

  it("B3 not B2: Unity/Prudential's hospital answer is older than 14 days", async () => {
    const f = await badgeFacts(F.unity, "prudential");
    expect(f.confirmed_days).toBe(20);
    expect(f.accepted).toBe(3);
  });

  it("B4: Gbawe/NHIS is on the NHIA list with fewer than 3 reports", async () => {
    const f = await badgeFacts(F.gbawe, "nhis");
    expect(f).toMatchObject({ listed_by: "nhia", hospital_says: null, accepted: 1, refused: 0 });
  });

  it("B5: Glefe has no NHIS link and no NHIS reports (since 2026-10-27 it is on Cosmopolitan's list, for B1)", async () => {
    const r = await one<{ links: number; reports: number }>(
      `select (select count(*) from public.facility_insurers where facility_id = $1 and insurer_id = $2)::int links,
              (select count(*) from public.card_reports where facility_id = $1 and insurer_id = $2)::int reports`,
      [F.glefe, NHIS],
    );
    expect(r).toEqual({ links: 0, reports: 0 });
  });

  it("a private card tells the whole story too: Cosmopolitan has B2, B3, B4 and B1 near Dansoman (2026-10-27)", async () => {
    const COSMO = "a0000000-0000-4000-8000-000000000002";
    const links = await rows<{ facility_id: string; listed_by: string; hospital_says: string | null }>(
      "select facility_id, listed_by, hospital_says from public.facility_insurers where insurer_id = $1",
      [COSMO],
    );
    const byId = new Map(links.map((l) => [l.facility_id, l]));
    expect(byId.get(F.gbawe)).toMatchObject({ listed_by: "insurer", hospital_says: null }); // B4
    expect(byId.get(F.glefe)).toMatchObject({ listed_by: "insurer", hospital_says: null }); // B1 with the refusals below
    expect(byId.get(F.akoma)).toMatchObject({ hospital_says: "accepts" }); // B2
    expect(byId.has(F.lakeside)).toBe(false); // B3 from patients alone
    const counts = await rows<{ facility_id: string; outcome: string; n: number }>(
      `select facility_id, outcome, count(*)::int n from public.card_reports
       where insurer_id = $1 and state = 'live' and created_at > now() - interval '30 days' and facility_id in ($2, $3)
       group by facility_id, outcome`,
      [COSMO, F.lakeside, F.glefe],
    );
    expect(counts).toEqual(
      expect.arrayContaining([
        { facility_id: F.lakeside, outcome: "covered", n: 5 },
        { facility_id: F.glefe, outcome: "refused", n: 4 },
      ]),
    );
  });
});

describe("demo search: antenatal, NHIS, 5 km from Dansoman (rules B and S1)", () => {
  it("finds the six antenatal facilities within 5 km, at the distances in the screen images", async () => {
    const found = await rows<{ id: string; km: number }>(
      `select f.id, round(pg_temp.km($1, $2, f.lat, f.lng)::numeric, 1)::float8 km
       from public.facilities f join public.facility_services s on s.facility_id = f.id
       where s.service_id = 'antenatal' and s.offered and pg_temp.km($1, $2, f.lat, f.lng) <= 5
       order by km`,
      [DANSOMAN.lat, DANSOMAN.lng],
    );
    expect(found).toEqual([
      { id: F.akoma, km: 1.8 },
      { id: F.glefe, km: 2 },
      { id: F.royalpalm, km: 2.2 },
      { id: F.lakeside, km: 2.6 },
      { id: F.gbawe, km: 3.1 },
      { id: F.pinecrest, km: 3.4 },
    ]);
    // Glefe (B5) and Royal Palm (B2x) drop out of the card search, leaving the four demo hospitals.
  });
});

describe("every freshness state appears (rule F)", () => {
  async function ageHours(facilityId: string, service: string): Promise<number | null> {
    const r = await rows<{ h: number }>(
      `select (extract(epoch from now() - created_at) / 3600)::float8 h from public.current_status
       where facility_id = $1 and service_id = $2`,
      [facilityId, service],
    );
    return r[0]?.h ?? null;
  }

  it("under 24 hours: Akoma antenatal, and the newest row wins", async () => {
    expect(await ageHours(F.akoma, "antenatal")).toBeLessThan(24);
    const r = await one<{ status: string; note: string | null; until_time: string | null; created_at: Date }>(
      "select status, note, until_time::text, created_at from public.current_status where facility_id = $1 and service_id = 'antenatal'",
      [F.akoma],
    );
    // Rule F: the demo till time follows demoUntilTime() at the reset (the seed writes this row 40 min
    // before the reset): between 12:00 and 20:00, or none from 19:00 on.
    expect(r).toMatchObject({ status: "open", note: null });
    const resetAt = new Date(new Date(r.created_at).getTime() + 40 * 60_000);
    expect(r.until_time).toBe(demoUntilTime(resetAt));
  });

  it("24 to 72 hours: Lakeside antenatal", async () => {
    const h = await ageHours(F.lakeside, "antenatal");
    expect(h).toBeGreaterThan(24);
    expect(h).toBeLessThan(72);
  });

  it("over 72 hours: Westhills X-ray", async () => {
    expect(await ageHours(F.westhills, "xray")).toBeGreaterThan(72);
  });

  it("no update ever: Gbawe antenatal", async () => {
    expect(await ageHours(F.gbawe, "antenatal")).toBeNull();
  });

  it("Akoma's obstetrician is from 2 pm", async () => {
    const r = await one<{ status: string; from_time: string }>(
      "select status, from_time::text from public.current_status where facility_id = $1 and service_id = 'obstetrician'",
      [F.akoma],
    );
    expect(r).toEqual({ status: "from_time", from_time: "14:00:00" });
  });
});

describe("top-ups (rule T)", () => {
  it("Akoma/NHIS: 3 scan top-ups of GH¢ 80 this week", async () => {
    const r = await one<{ n: number; median: number }>(
      `select count(*)::int n, percentile_cont(0.5) within group (order by amount_ghs)::float8 median
       from public.card_reports
       where facility_id = $1 and insurer_id = $2 and outcome = 'topup' and item = 'scan'
         and state = 'live' and created_at > now() - interval '7 days'`,
      [F.akoma, NHIS],
    );
    expect(r).toEqual({ n: 3, median: 80 });
  });

  it("Royal Palm/Cosmopolitan: a newer hospital correction of the drugs top-up", async () => {
    const r = await one<{ kind: string; item: string; amount: number }>(
      "select kind, item, amount_ghs::float8 amount from public.hospital_responses where facility_id = $1",
      [F.royalpalm],
    );
    expect(r).toEqual({ kind: "correct_topup", item: "drugs", amount: 40 });
  });
});

describe("emergency units within 15 km (rule S2)", () => {
  it("are Akoma and Westhills accepting, and Pinecrest full", async () => {
    const r = await rows<{ id: string; status: string | null }>(
      `select f.id, cs.status from public.facilities f
       join public.facility_services s on s.facility_id = f.id and s.service_id = 'emergency' and s.offered
       left join public.current_status cs on cs.facility_id = f.id and cs.service_id = 'emergency'
       where pg_temp.km($1, $2, f.lat, f.lng) <= 15 order by pg_temp.km($1, $2, f.lat, f.lng)`,
      [DANSOMAN.lat, DANSOMAN.lng],
    );
    expect(r).toEqual([
      { id: F.akoma, status: "accepting" },
      { id: F.pinecrest, status: "full" },
      { id: F.westhills, status: "accepting" },
    ]);
  });
});

describe("insurer figures (rule K)", () => {
  it("NHIS members were refused 23 times at 6 hospitals in 30 days; held and rejected never count", async () => {
    const r = await one<{ refused: number; hospitals: number }>(
      `select count(*)::int refused, count(distinct facility_id)::int hospitals from public.card_reports
       where insurer_id = $1 and outcome = 'refused' and state = 'live' and created_at > now() - interval '30 days'`,
      [NHIS],
    );
    expect(r).toEqual({ refused: 23, hospitals: 6 });
  });

  it("Pinecrest leads the refusals table with 9", async () => {
    const r = await one<{ n: number }>(
      `select count(*)::int n from public.card_reports where facility_id = $1 and insurer_id = $2
       and outcome = 'refused' and state = 'live' and created_at > now() - interval '30 days'`,
      [F.pinecrest, NHIS],
    );
    expect(r.n).toBe(9);
  });

  it("has 30 days of search counts, with gaps where no confirmed result was found", async () => {
    const r = await one<{ days: number; gap_cells: number }>(
      `select count(distinct day)::int days,
              count(distinct area_cell) filter (where not had_confirmed_result)::int gap_cells
       from public.search_daily where insurer_id = $1`,
      [NHIS],
    );
    expect(r.days).toBe(30);
    expect(r.gap_cells).toBeGreaterThanOrEqual(3);
  });

  it("Akoma has 214 views in the last 7 days (morning check reach)", async () => {
    const r = await one<{ views: number }>(
      "select sum(views)::int views from public.reach_daily where facility_id = $1 and day >= current_date - 7",
      [F.akoma],
    );
    expect(r.views).toBe(214);
  });
});

describe("reset_demo() puts the demo back (Prompt 8)", () => {
  it("undoes a closed clinic, extra reports and logged searches", async () => {
    await db.exec(`
      insert into public.status_updates (facility_id, service_id, status, source)
        values ('${F.akoma}', 'antenatal', 'closed', 'hospital');
      insert into public.card_reports (facility_id, insurer_id, outcome, device_hash)
        values ('${F.akoma}', '${NHIS}', 'refused', 'demo-visitor');
      select public.log_search(null, '9.40,-0.86', false);
    `);
    await db.exec("select public.reset_demo()");
    const r = await one<{ status: string; extra: number; searches: number }>(
      `select (select status from public.current_status where facility_id = $1 and service_id = 'antenatal') status,
              (select count(*) from public.card_reports where device_hash = 'demo-visitor')::int extra,
              (select count(*) from public.search_daily where area_cell = '9.40,-0.86')::int searches`,
      [F.akoma],
    );
    expect(r).toEqual({ status: "open", extra: 0, searches: 0 });
  });
});

describe("seed can run again (demo reset)", () => {
  it("gives the same counts the second time", async () => {
    const count = () =>
      one<{ f: number; r: number; s: number }>(
        `select (select count(*) from public.facilities)::int f, (select count(*) from public.card_reports)::int r,
                (select count(*) from public.search_daily)::int s`,
      );
    const before = await count();
    await db.exec(seedSql);
    expect(await count()).toEqual(before);
  });
});

describe("access rules (section 3)", () => {
  const HOSPITAL_USER = "b0000000-0000-4000-8000-000000000001";
  const INSURER_USER = "b0000000-0000-4000-8000-000000000002";
  const ADMIN_USER = "b0000000-0000-4000-8000-000000000003";

  beforeAll(async () => {
    await db.exec(`
      insert into auth.users (id) values ('${HOSPITAL_USER}'), ('${INSURER_USER}'), ('${ADMIN_USER}');
      insert into public.profiles (user_id, role, facility_id, insurer_id) values
        ('${HOSPITAL_USER}', 'hospital', '${F.akoma}', null),
        ('${INSURER_USER}', 'insurer', null, '${NHIS}'),
        ('${ADMIN_USER}', 'admin', null, null);
    `);
  });

  it("anyone can read facilities, current status, insurer links and live reports", async () => {
    await as(db, "anon", null, async () => {
      const r = await one<{ f: number; s: number; l: number; p: number }>(
        `select (select count(*) from public.facilities where source = 'demo')::int f, (select count(*) from public.current_status)::int s,
                (select count(*) from public.facility_insurers)::int l, (select count(*) from public.public_card_reports)::int p`,
      );
      expect(r.f).toBe(18);
      expect(r.s).toBeGreaterThan(0);
      expect(r.l).toBeGreaterThan(0);
      expect(r.p).toBeGreaterThan(0);
    });
  });

  it("the public report view has no device hash and no held or rejected reports (rules 2 and A)", async () => {
    const cols = (
      await rows<{ column_name: string }>(
        "select column_name from information_schema.columns where table_name = 'public_card_reports'",
      )
    ).map((c) => c.column_name);
    expect(cols).not.toContain("device_hash");
    expect(cols).not.toContain("state");
    const r = await one<{ live: number; all: number }>(
      `select (select count(*) from public.public_card_reports)::int live,
              (select count(*) from public.card_reports where state = 'live')::int all`,
    );
    expect(r.live).toBe(r.all);
  });

  it("anon cannot read raw reports or insert any report (reports go only through /api/reports)", async () => {
    await as(db, "anon", null, async () => {
      const r = await one<{ n: number }>("select count(*)::int n from public.card_reports");
      expect(r.n).toBe(0);
      await expect(
        db.query(
          "insert into public.card_reports (facility_id, insurer_id, outcome, device_hash) values ($1, $2, 'covered', 'x')",
          [F.akoma, NHIS],
        ),
      ).rejects.toThrow();
      await expect(
        db.query(
          "insert into public.public_card_reports (facility_id, insurer_id, outcome) values ($1, $2, 'covered')",
          [F.akoma, NHIS],
        ),
      ).rejects.toThrow();
    });
  });

  it("hospital staff can add status only for their own facility (rule M)", async () => {
    await as(db, "authenticated", HOSPITAL_USER, async () => {
      await db.query(
        "insert into public.status_updates (facility_id, service_id, status, source, created_by) values ($1, 'antenatal', 'closed', 'hospital', $2)",
        [F.akoma, HOSPITAL_USER],
      );
      await expect(
        db.query(
          "insert into public.status_updates (facility_id, service_id, status, source, created_by) values ($1, 'antenatal', 'closed', 'hospital', $2)",
          [F.pinecrest, HOSPITAL_USER],
        ),
      ).rejects.toThrow();
    });
  });

  it("hospital staff can confirm their own cards but cannot change which list they are on", async () => {
    await as(db, "authenticated", HOSPITAL_USER, async () => {
      const ok = await db.query(
        "update public.facility_insurers set hospital_says = 'accepts', hospital_confirmed_at = now() where facility_id = $1 and insurer_id = $2",
        [F.akoma, NHIS],
      );
      expect(ok.affectedRows).toBe(1);
      const other = await db.query(
        "update public.facility_insurers set hospital_says = 'does_not' where facility_id = $1",
        [F.pinecrest],
      );
      expect(other.affectedRows).toBe(0);
      await expect(
        db.query("update public.facility_insurers set listed_by = 'nhia' where facility_id = $1 and insurer_id = $2", [
          F.akoma,
          NHIS,
        ]),
      ).rejects.toThrow(/Only admin/);
    });
  });

  it("insurer staff read only their own insurer's search counts (rule K)", async () => {
    await as(db, "authenticated", INSURER_USER, async () => {
      const r = await one<{ mine: number; others: number }>(
        `select count(*) filter (where insurer_id = $1)::int mine,
                count(*) filter (where insurer_id is distinct from $1)::int others from public.search_daily`,
        [NHIS],
      );
      expect(r.mine).toBeGreaterThan(0);
      expect(r.others).toBe(0);
    });
    await as(db, "anon", null, async () => {
      const r = await one<{ n: number }>("select count(*)::int n from public.search_daily");
      expect(r.n).toBe(0);
    });
  });

  it("log_search adds one count per search, for a card or for cash (rule K)", async () => {
    const before = await rows<{ searches: number }>(
      "select searches from public.search_daily where insurer_id is null and area_cell = '9.40,-0.86' and day = (now() at time zone 'utc')::date",
    );
    expect(before).toEqual([]);
    await db.query("select public.log_search(null, '9.40,-0.86', false)");
    await db.query("select public.log_search(null, '9.40,-0.86', false)");
    const after = await one<{ searches: number }>(
      "select searches from public.search_daily where insurer_id is null and area_cell = '9.40,-0.86' and day = (now() at time zone 'utc')::date",
    );
    expect(after.searches).toBe(2);
  });

  it("log_search refuses anything that isn't an area cell", async () => {
    await expect(db.query("select public.log_search(null, 'Ama Mensah', false)")).rejects.toThrow(/Not an area cell/);
  });

  it("anon and signed-in users cannot call log_search", async () => {
    await as(db, "anon", null, async () => {
      await expect(db.query("select public.log_search(null, '5.54,-0.28', true)")).rejects.toThrow();
    });
    await as(db, "authenticated", INSURER_USER, async () => {
      await expect(db.query("select public.log_search(null, '5.54,-0.28', true)")).rejects.toThrow();
    });
  });

  it("anon and signed-in users cannot reset the demo", async () => {
    await as(db, "anon", null, async () => {
      await expect(db.query("select public.reset_demo()")).rejects.toThrow();
    });
    await as(db, "authenticated", INSURER_USER, async () => {
      await expect(db.query("select public.reset_demo()")).rejects.toThrow();
    });
  });

  it("admin can read raw reports", async () => {
    await as(db, "authenticated", ADMIN_USER, async () => {
      const r = await one<{ n: number }>("select count(*)::int n from public.card_reports");
      expect(r.n).toBeGreaterThan(0);
    });
  });
});
