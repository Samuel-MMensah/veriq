// @vitest-environment node
// The rules run on the real seed through the real queries: the demo story (SPEC section 9) holds.
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getEmergencyCandidates, getInsurerNetwork, getSearchCandidates } from "@/lib/db/queries";
import { fakeDb } from "@/lib/db/fake-postgrest";
import { createDb } from "@/lib/db/pglite";
import { badge } from "./badge";
import { freshness } from "./freshness";
import { insurerFigures } from "./kpi";
import { sortEmergency, sortResults } from "./sort";
import { topUps } from "./topup";

const NHIS = "a0000000-0000-4000-8000-000000000001";
const DANSOMAN = { lat: 5.545, lng: -0.265 };

let pg: PGlite;
const now = new Date();

beforeAll(async () => {
  pg = await createDb();
}, 60_000);

afterAll(async () => {
  await pg?.close();
});

describe("demo step 3: antenatal + NHIS near Dansoman (rules B, F, T, S1)", () => {
  it("shows Akoma, Lakeside, Gbawe, then Pinecrest last", async () => {
    const candidates = await getSearchCandidates(fakeDb(pg), {
      serviceIds: ["antenatal"],
      insurerId: NHIS,
      ...DANSOMAN,
      radiusKm: 5,
      now,
    });
    const items = candidates.map((c) => ({
      id: c.facility.id,
      name: c.facility.name,
      lat: c.facility.lat,
      lng: c.facility.lng,
      badge: badge({ link: c.link, reports: c.reports, now }).id,
      badgeText: badge({ link: c.link, reports: c.reports, now }).text,
      status: c.services[0]!.status?.status ?? null,
      statusUpdatedAt: c.services[0]!.status?.created_at ?? null,
      topUps: topUps({ reports: c.reports, responses: c.responses, now }),
      fresh: freshness(c.services[0]!.status, now).state,
    }));
    const sorted = sortResults(items, { origin: DANSOMAN, radiusKm: 5, now });

    expect(sorted.map((r) => [r.name, r.badge, r.distanceKm])).toEqual([
      ["Akoma Mission Hospital", "B2", 1.8],
      ["Lakeside Family Clinic", "B3", 2.6],
      ["Gbawe Community Clinic", "B4", 3.1],
      ["Pinecrest Specialist Hospital", "B1", 3.4],
    ]);
    // Pinecrest's patient-facing count matches the insurer view's 9 (team decision 2026-10-22).
    expect(sorted[3]!.badgeText).toBe("Listed, but 9 patients were refused in the last 30 days");
    // Demo step 4: Akoma's scan top-up.
    expect(sorted[0]!.topUps.map((t) => t.text)).toEqual(["Scan top-up about GH¢ 80 (3 patients, last 60 days)"]);
    expect(sorted.map((r) => r.fresh)).toEqual(["fresh", "aging", "none", "fresh"]);
  });
});

describe("demo step 7: emergency mode (rule S2)", () => {
  it("lists Akoma, Westhills, then Pinecrest (full), within 15 km", async () => {
    const candidates = await getEmergencyCandidates(fakeDb(pg), { ...DANSOMAN, now });
    const sorted = sortEmergency(
      candidates.map((c) => ({
        id: c.facility.id,
        name: c.facility.name,
        lat: c.facility.lat,
        lng: c.facility.lng,
        status: c.status?.status ?? null,
        statusUpdatedAt: c.status?.created_at ?? null,
      })),
      { origin: DANSOMAN, now },
    );
    expect(sorted.map((r) => r.name)).toEqual([
      "Akoma Mission Hospital",
      "Westhills District Hospital",
      "Pinecrest Specialist Hospital",
    ]);
  });
});

describe("demo step 8: insurer view (rule K)", () => {
  it("NHIS members were refused 23 times at 6 hospitals; Pinecrest leads", async () => {
    // Read as the table owner here; Prompt 7 adds the insurer login that RLS expects.
    const network = await getInsurerNetwork(fakeDb(pg), NHIS, now);
    const figures = insurerFigures({
      facilities: network!.facilities,
      links: network!.links,
      reports: network!.reports,
      searches: network!.searches,
      now,
    });
    expect(figures.refused).toEqual({ count: 23, facilities: 6 });
    expect(figures.turnedAway[0]).toMatchObject({ name: "Pinecrest Specialist Hospital", refusals: 9, listed: true });
    expect(figures.turnedAway.find((r) => r.name === "Akoma Mission Hospital")).toMatchObject({ listed: false, refusals: 0 });
    expect(figures.gaps.map((g) => g.nearestArea)).toContain("Ashaiman");
  });
});
