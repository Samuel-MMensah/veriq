// @vitest-environment node
// The typed reads, run against the real migrations and seed in PGlite, as the anon role.
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fakeDb } from "@/lib/db/fake-postgrest";
import { as, createDb } from "@/lib/db/pglite";
import {
  boundingBox,
  getEmergencyCandidates,
  getFacilityDetail,
  getInsurerBySlug,
  getInsurerNetwork,
  getMorningCheck,
  getSearchCandidates,
  listInsurers,
  listServices,
  logSearch,
} from "./queries";

const AKOMA = "f0000000-0000-4000-8000-000000000001";
const GBAWE = "f0000000-0000-4000-8000-000000000003";
const GLEFE = "f0000000-0000-4000-8000-000000000007";
const NHIS = "a0000000-0000-4000-8000-000000000001";
const INSURER_USER = "b0000000-0000-4000-8000-000000000002";
const DANSOMAN = { lat: 5.545, lng: -0.265 };

let pg: PGlite;
const now = new Date();
const anon = <T>(fn: () => Promise<T>) => as(pg, "anon", null, fn);

beforeAll(async () => {
  pg = await createDb();
  await pg.exec(`
    insert into auth.users (id) values ('${INSURER_USER}');
    insert into public.profiles (user_id, role, insurer_id) values ('${INSURER_USER}', 'insurer', '${NHIS}');
  `);
}, 60_000);

afterAll(async () => {
  await pg?.close();
});

describe("boundingBox", () => {
  it("covers the radius in every direction", () => {
    const box = boundingBox(DANSOMAN.lat, DANSOMAN.lng, 5);
    expect(box.maxLat - DANSOMAN.lat).toBeCloseTo(5 / 111.195, 6);
    expect(DANSOMAN.lng - box.minLng).toBeGreaterThan(5 / 111.195);
  });
});

describe("reference lists", () => {
  it("lists the 12 services and 5 insurers", async () => {
    const db = fakeDb(pg);
    await anon(async () => {
      expect(await listServices(db)).toHaveLength(12);
      expect((await listInsurers(db)).map((i) => i.slug)).toContain("nhis");
      expect((await getInsurerBySlug(db, "nhis"))?.id).toBe(NHIS);
      expect(await getInsurerBySlug(db, "nope")).toBeNull();
    });
  });
});

describe("getSearchCandidates (input to rules B, F, T and S1)", () => {
  it("returns the antenatal facilities near Dansoman with their NHIS facts", async () => {
    const db = fakeDb(pg);
    const found = await anon(() =>
      getSearchCandidates(db, { serviceId: "antenatal", insurerId: NHIS, ...DANSOMAN, radiusKm: 5, now }),
    );
    expect(found.map((c) => c.facility.name).sort()).toEqual([
      "Akoma Mission Hospital",
      "Gbawe Community Clinic",
      "Glefe Seaside Clinic",
      "Lakeside Family Clinic",
      "Pinecrest Specialist Hospital",
      "Royal Palm Maternity Home",
    ]);

    const akoma = found.find((c) => c.facility.id === AKOMA)!;
    expect(akoma.link?.hospital_says).toBe("accepts");
    expect(akoma.status?.status).toBe("open");
    expect(akoma.usualHours).toBe("Mon to Fri, 8 am to 4 pm");
    // 12-month window (report history): 9 accepted in the last 30 days plus one older refusal.
    expect(akoma.reports).toHaveLength(10);
    expect(akoma.reports.every((r) => r.insurer_id === NHIS)).toBe(true);
    expect(akoma.reports.filter((r) => r.item === "scan").map((r) => r.amount_ghs)).toEqual([80, 80, 80]);
    expect(akoma.reports[0]!.created_at >= akoma.reports[1]!.created_at).toBe(true); // newest first

    expect(found.find((c) => c.facility.id === GBAWE)!.status).toBeNull(); // rule F: no update yet
    expect(found.find((c) => c.facility.id === GLEFE)!.link).toBeNull(); // rule B5
  });

  it("returns no card facts for No card/cash", async () => {
    const db = fakeDb(pg);
    const found = await anon(() =>
      getSearchCandidates(db, { serviceId: "antenatal", insurerId: null, ...DANSOMAN, radiusKm: 5, now }),
    );
    expect(found).toHaveLength(6);
    expect(found.every((c) => c.link === null && c.reports.length === 0)).toBe(true);
  });

  it("returns nothing when no facility is near", async () => {
    const db = fakeDb(pg);
    const found = await anon(() =>
      getSearchCandidates(db, { serviceId: "antenatal", insurerId: NHIS, lat: 9.4, lng: -0.85, radiusKm: 5, now }),
    );
    expect(found).toEqual([]);
  });
});

describe("getFacilityDetail (screen 3)", () => {
  it("returns Akoma's services, statuses and cards with insurer names", async () => {
    const db = fakeDb(pg);
    const detail = await anon(() => getFacilityDetail(db, AKOMA, now));
    expect(detail?.facility.name).toBe("Akoma Mission Hospital");
    expect(detail?.services).toHaveLength(8);
    expect(detail?.statuses.map((s) => s.service_id).sort()).toEqual(["antenatal", "emergency", "obstetrician", "ultrasound"]);
    expect(detail?.links.map((l) => l.insurer?.name).sort()).toEqual(["Cosmopolitan Health", "NHIS", "Prudential"]);
    expect(detail?.reports.some((r) => "device_hash" in r)).toBe(false); // rule 2
  });

  it("returns null for an unknown id", async () => {
    const db = fakeDb(pg);
    expect(await anon(() => getFacilityDetail(db, "f0000000-0000-4000-8000-999999999999", now))).toBeNull();
  });
});

describe("getEmergencyCandidates (input to rule S2)", () => {
  it("returns the emergency units in the 15 km box with all their card links", async () => {
    const db = fakeDb(pg);
    const found = await anon(() => getEmergencyCandidates(db, { ...DANSOMAN, now }));
    // The box is a square, so its corners reach past 15 km: Madina (17.5 km) is in it.
    // Rule S2's exact 15 km cut is done with haversine in lib/rules.
    expect(found.map((c) => [c.facility.name, c.status?.status]).sort()).toEqual([
      ["Akoma Mission Hospital", "accepting"],
      ["Madina Family Hospital", "full"],
      ["Pinecrest Specialist Hospital", "full"],
      ["Westhills District Hospital", "accepting"],
    ]);
    expect(found.find((c) => c.facility.id === AKOMA)!.links).toHaveLength(3);
  });
});

describe("getMorningCheck (screen 16)", () => {
  it("adds the last week's reach", async () => {
    const db = fakeDb(pg);
    // Reach is staff-only; read it with the table owner here. Prompt 7 adds the hospital login.
    const check = await getMorningCheck(db, AKOMA, now);
    expect(check?.reach.reduce((sum, d) => sum + d.views, 0)).toBe(214);
  });
});

describe("logSearch (rule K)", () => {
  it("counts a search through the server's service access", async () => {
    await logSearch(fakeDb(pg, "owner"), { insurerId: NHIS, areaCell: "9.40,-0.86", hadConfirmedResult: false });
    await logSearch(fakeDb(pg, "owner"), { insurerId: NHIS, areaCell: "9.40,-0.86", hadConfirmedResult: false });
    const r = await pg.query<{ searches: number }>(
      "select searches from public.search_daily where insurer_id = $1 and area_cell = '9.40,-0.86'",
      [NHIS],
    );
    expect(r.rows[0]?.searches).toBe(2);
  });

  it("is refused for the public key", async () => {
    await expect(
      logSearch(fakeDb(pg, "anon"), { insurerId: null, areaCell: "9.40,-0.86", hadConfirmedResult: false }),
    ).rejects.toThrow(/Could not log the search/);
  });
});

describe("getInsurerNetwork (input to rule K)", () => {
  it("returns NHIS links, 30-day reports and its own search counts", async () => {
    const db = fakeDb(pg);
    const network = await as(pg, "authenticated", INSURER_USER, () => getInsurerNetwork(db, NHIS, now));
    const refused = network!.reports.filter((r) => r.outcome === "refused");
    expect(refused).toHaveLength(23);
    expect(new Set(refused.map((r) => r.facility_id)).size).toBe(6);
    expect(network!.searches.length).toBeGreaterThan(0);
    expect(network!.facilities.length).toBeGreaterThanOrEqual(network!.links.length);
  });

  it("shows anon no search counts", async () => {
    const db = fakeDb(pg);
    const network = await anon(() => getInsurerNetwork(db, NHIS, now));
    expect(network!.searches).toEqual([]);
  });
});
