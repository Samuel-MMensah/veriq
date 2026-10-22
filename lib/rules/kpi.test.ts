import { hadConfirmedResult, insurerFigures, type KpiFacility, type KpiLink, type KpiReport, type KpiSearch } from "./kpi";
import { DAY_MS } from "./time";

const now = new Date("2026-10-22T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * DAY_MS).toISOString();
const day = (d: number) => daysAgo(d).slice(0, 10);

const facilities: KpiFacility[] = [
  { id: "pinecrest", name: "Pinecrest", area: "Mataheko", lat: 5.574, lng: -0.254 },
  { id: "madina", name: "Madina", area: "Madina", lat: 5.666, lng: -0.163 },
  { id: "akoma", name: "Akoma", area: "Kaneshie", lat: 5.556, lng: -0.254 },
  { id: "gbawe", name: "Gbawe", area: "Gbawe", lat: 5.559, lng: -0.289 },
  { id: "ashaiman", name: "Ashaiman", area: "Ashaiman", lat: 5.631, lng: -0.027 },
];

const links: KpiLink[] = [
  { facility_id: "pinecrest", listed_by: "nhia", hospital_says: "accepts", hospital_confirmed_at: daysAgo(12) },
  { facility_id: "madina", listed_by: "nhia", hospital_says: null, hospital_confirmed_at: null },
  { facility_id: "akoma", listed_by: "none", hospital_says: "accepts", hospital_confirmed_at: daysAgo(2) },
  { facility_id: "gbawe", listed_by: "nhia", hospital_says: "accepts", hospital_confirmed_at: daysAgo(1) },
  { facility_id: "ashaiman", listed_by: "nhia", hospital_says: null, hospital_confirmed_at: null },
];

const r = (facility_id: string, outcome: KpiReport["outcome"], ...ages: number[]): KpiReport[] =>
  ages.map((a) => ({ facility_id, outcome, created_at: daysAgo(a) }));

const reports: KpiReport[] = [
  ...r("pinecrest", "refused", 0, 4, 8, 14, 16),
  ...r("pinecrest", "refused", 45), // older than 30 days
  ...r("madina", "refused", 5, 9, 13),
  ...r("akoma", "covered", 1, 2, 3, 4),
  { facility_id: "madina", outcome: "refused", created_at: daysAgo(1), state: "held" },
];

const searches: KpiSearch[] = [
  { day: day(1), area_cell: "5.54,-0.28", had_confirmed_result: true, searches: 70 },
  { day: day(2), area_cell: "5.54,-0.28", had_confirmed_result: false, searches: 5 },
  { day: day(1), area_cell: "5.62,-0.04", had_confirmed_result: false, searches: 20 },
  { day: day(3), area_cell: "5.70,-0.30", had_confirmed_result: false, searches: 5 },
  { day: day(40), area_cell: "5.70,-0.30", had_confirmed_result: false, searches: 999 }, // older than 30 days
];

const figures = () => insurerFigures({ facilities, links, reports, searches, now });

describe("rule K: insurer figures, last 30 days", () => {
  it("hospitals on the list", () => {
    expect(figures().onList).toBe(4); // Akoma is not listed
  });

  it("confirmed: hospitals at B2, and the share of the list", () => {
    const f = figures();
    // Akoma and Gbawe are B2; Pinecrest's fresh answer loses to B1.
    expect(f.confirmed).toBe(2);
    expect(f.confirmedShareOfList).toBeCloseTo(1 / 4); // only Gbawe is both listed and B2
  });

  it("members refused: live refusals in 30 days, and how many hospitals", () => {
    expect(figures().refused).toEqual({ count: 8, facilities: 2 });
  });

  it("member searches, and the share that found a confirmed hospital", () => {
    const f = figures();
    expect(f.searches.total).toBe(100);
    expect(f.searches.confirmedShare).toBeCloseTo(0.7);
  });

  it("refusals table: most refusals first, with the last report, plus unlisted hospitals that served members", () => {
    expect(figures().turnedAway).toEqual([
      { facilityId: "pinecrest", name: "Pinecrest", listed: true, refusals: 5, accepted: 0, lastReportAt: daysAgo(0) },
      { facilityId: "madina", name: "Madina", listed: true, refusals: 3, accepted: 0, lastReportAt: daysAgo(5) },
      { facilityId: "akoma", name: "Akoma", listed: false, refusals: 0, accepted: 4, lastReportAt: daysAgo(1) },
    ]);
  });

  it("coverage gaps: cells whose searches found no confirmed hospital, biggest first, named by the nearest hospital", () => {
    expect(figures().gaps).toEqual([
      { areaCell: "5.62,-0.04", searches: 20, nearestArea: "Ashaiman" },
      { areaCell: "5.54,-0.28", searches: 5, nearestArea: "Kaneshie" },
      { areaCell: "5.70,-0.30", searches: 5, nearestArea: null },
    ]);
  });

  it("handles an insurer with nothing yet", () => {
    const f = insurerFigures({ facilities: [], links: [], reports: [], searches: [], now });
    expect(f).toMatchObject({ onList: 0, confirmed: 0, confirmedShareOfList: 0, refused: { count: 0, facilities: 0 } });
    expect(f.searches).toEqual({ total: 0, confirmedShare: 0 });
  });
});

describe("rule K: did a search find a confirmed hospital?", () => {
  it("is true when a B2 or B3 hospital is within 5 km", () => {
    expect(hadConfirmedResult([{ badge: "B4", distanceKm: 1 }, { badge: "B3", distanceKm: 5 }])).toBe(true);
  });

  it("is false when the only B2 or B3 is further than 5 km, or there are none", () => {
    expect(hadConfirmedResult([{ badge: "B2", distanceKm: 5.1 }, { badge: "B1", distanceKm: 1 }])).toBe(false);
    expect(hadConfirmedResult([])).toBe(false);
  });
});
