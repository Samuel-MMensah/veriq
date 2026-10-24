// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fakeDb } from "@/lib/db/fake-postgrest";
import { createDb } from "@/lib/db/pglite";
import { getEmergencyCandidates, getFacilityDetail, getSearchCandidates, listInsurers, listServices } from "@/lib/db/queries";
import { HOUR_MS } from "@/lib/rules/time";
import { DEFAULT_AREA, parseSearch } from "./catalog";
import { buildFacilityView, directionsUrl } from "./facility";
import { submitReport } from "@/lib/reports/submit";
import { buildEmergency, cardNote } from "./emergency";
import { buildResults } from "./results";
import { whatChanged } from "./thanks";
import { clockFromTime, statusView } from "./status";

const NHIS = "a0000000-0000-4000-8000-000000000001";
const AKOMA = "f0000000-0000-4000-8000-000000000001";
const DANSOMAN = { lat: 5.545, lng: -0.265 };
let pg: PGlite;
let serviceNames = new Map<string, string>();
// Taken after seeding: the seed's times are relative to the moment it runs.
let now = new Date();
beforeAll(async () => {
  pg = await createDb();
  serviceNames = new Map((await listServices(fakeDb(pg))).map((x) => [x.id, x.name]));
  now = new Date();
}, 60_000);
afterAll(async () => {
  await pg?.close();
});

describe("parseSearch (results URL)", () => {
  it("reads service, card, point and radius", () => {
    expect(parseSearch({ service: "antenatal", card: "nhis", lat: "5.545", lng: "-0.265", r: "10", area: "dansoman" })).toEqual({
      service: "antenatal",
      serviceIds: ["antenatal", "delivery", "c_section"],
      serviceLabel: "Antenatal / maternity",
      card: "nhis",
      origin: DANSOMAN,
      areaName: "Dansoman",
      radiusKm: 10,
    });
  });

  it("falls back to the named area when there is no point, and to 5 km", () => {
    expect(parseSearch({ service: "gp", card: "cash", area: "dansoman" })).toMatchObject({
      origin: { lat: DEFAULT_AREA.lat, lng: DEFAULT_AREA.lng },
      radiusKm: 5,
    });
  });

  it("returns null for a broken link", () => {
    expect(parseSearch({ card: "nhis", area: "dansoman" })).toBeNull();
    expect(parseSearch({ service: "antenatal", card: "nhis" })).toBeNull();
    expect(parseSearch({ service: "x'; drop", card: "nhis", area: "dansoman" })).toBeNull();
  });
});

describe("statusView (rules F and 4)", () => {
  it("reads the note, the source and the age", () => {
    const v = statusView(
      { status: "open", from_time: null, note: "Open till 4 pm", source: "hospital", created_at: new Date(now.getTime() - 40 * 60_000).toISOString() },
      now,
    );
    expect(v).toMatchObject({ word: "Open till 4 pm", tone: "good", sourceText: "updated by hospital 40 min ago" });
  });

  it("reads 'From 2 pm' for a specialist time", () => {
    expect(clockFromTime("14:00:00")).toBe("2 pm");
    expect(clockFromTime("09:30:00")).toBe("9:30 am");
    expect(clockFromTime("00:00:00")).toBe("12 am");
  });

  it("greys a status over 72 hours old", () => {
    const v = statusView({ status: "open", from_time: null, note: null, source: "hospital", created_at: new Date(now.getTime() - 80 * HOUR_MS).toISOString() }, now);
    expect(v).toMatchObject({ tone: "unknown", freshness: { state: "stale", warning: "not updated recently" } });
  });

  it("says 'No update yet' when there has never been one", () => {
    expect(statusView(null, now)).toMatchObject({ word: "No update yet", sourceText: null });
  });
});

describe("buildResults (screen 2)", () => {
  it("demo: 4 hospitals in the right order, 2 left out, a confirmed result found", async () => {
    const candidates = await getSearchCandidates(fakeDb(pg, "anon"), {
      serviceIds: ["antenatal"],
      insurerId: NHIS,
      ...DANSOMAN,
      radiusKm: 5,
      now,
    });
    const results = buildResults({ candidates, serviceNames, withCard: true, origin: DANSOMAN, radiusKm: 5, now });
    expect(results.cards.map((c) => [c.name, c.badge?.id, c.distanceKm])).toEqual([
      ["Akoma Mission Hospital", "B2", 1.8],
      ["Lakeside Family Clinic", "B3", 2.6],
      ["Gbawe Community Clinic", "B4", 3.1],
      ["Pinecrest Specialist Hospital", "B1", 3.4],
    ]);
    expect(results.hiddenCount).toBe(2);
    expect(results.hadConfirmedResult).toBe(true);
    expect(results.cards[0]!.status.word).toBe("Open till 4 pm");
    expect(results.cards[0]!.topUps).toEqual(["Scan top-up about GH¢ 80 (3 patients, last 60 days)"]);
    expect(results.cards[1]!.usualHours).toBe("Tue and Thu");
    expect(results.cards[2]!.status.word).toBe("No update yet");
  });

  it("No card/cash: every antenatal facility in 5 km, no badges", async () => {
    const candidates = await getSearchCandidates(fakeDb(pg, "anon"), {
      serviceIds: ["antenatal"],
      insurerId: null,
      ...DANSOMAN,
      radiusKm: 5,
      now,
    });
    const results = buildResults({ candidates, serviceNames, withCard: false, origin: DANSOMAN, radiusKm: 5, now });
    expect(results.cards).toHaveLength(6);
    expect(results.cards.every((c) => c.badge === null && c.topUps.length === 0)).toBe(true);
    expect(results.hadConfirmedResult).toBe(false);
  });
});

describe("buildResults with a chip that covers several services", () => {
  const search = async (serviceIds: string[], insurerId: string | null) =>
    buildResults({
      candidates: await getSearchCandidates(fakeDb(pg, "anon"), { serviceIds, insurerId, ...DANSOMAN, radiusKm: 5, now }),
      serviceNames,
      withCard: insurerId !== null,
      origin: DANSOMAN,
      radiusKm: 5,
      now,
    });

  it("Antenatal / maternity (antenatal, delivery, C-section) keeps the demo: same 4, same order", async () => {
    const results = await search(parseSearch({ service: "antenatal", card: "nhis", area: "dansoman" })!.serviceIds, NHIS);
    expect(results.cards.map((c) => c.name)).toEqual([
      "Akoma Mission Hospital",
      "Lakeside Family Clinic",
      "Gbawe Community Clinic",
      "Pinecrest Specialist Hospital",
    ]);
    // Akoma offers all three; the antenatal clinic has the best status today.
    expect(results.cards[0]).toMatchObject({ serviceName: "Antenatal clinic", status: { word: "Open till 4 pm" } });
  });

  it("Scan / X-ray (ultrasound, X-ray, CT) shows each hospital's best scan service and names it", async () => {
    const results = await search(parseSearch({ service: "scan", card: "cash", area: "dansoman" })!.serviceIds, null);
    const byName = Object.fromEntries(results.cards.map((c) => [c.name, `${c.serviceName}: ${c.status.word}`]));
    expect(byName).toMatchObject({
      "Akoma Mission Hospital": "Ultrasound scan: Available",
      // Unity: ultrasound working beats CT down.
      "Unity Diagnostic Centre": "Ultrasound scan: Available",
    });
    // Westhills X-ray is 5 days old, so it is greyed (rule F).
    expect(results.cards.find((c) => c.name === "Westhills District Hospital")?.status.freshness.state).toBe("stale");
  });

  it("Specialist (obstetrician, children's doctor) finds both kinds", async () => {
    const results = await search(parseSearch({ service: "specialist", card: "cash", area: "dansoman" })!.serviceIds, null);
    const services = new Set(results.cards.map((c) => c.serviceName));
    expect(services).toEqual(new Set(["Obstetrician", "Children's doctor"]));
  });
});

describe("buildFacilityView (screen 3)", () => {
  it("Akoma: type, area and distance; today's grid; cards with sources, searched card first", async () => {
    const db = fakeDb(pg, "anon");
    const detail = (await getFacilityDetail(db, AKOMA, now))!;
    const view = buildFacilityView({ detail, insurers: await listInsurers(db), origin: DANSOMAN, cardSlug: "nhis", now });

    expect(view.subtitle).toBe("Mission · Kaneshie · 1.8 km");
    expect(view.directionsUrl).toBe(directionsUrl(detail.facility));
    expect(view.todayUpdated).toMatch(/^Updated by hospital \d{1,2}:\d{2} (am|pm)$/);
    const words = Object.fromEntries(view.today.map((t) => [t.label, t.status.word]));
    expect(words).toMatchObject({
      "Antenatal clinic": "Open till 4 pm",
      "Emergency unit": "Accepting",
      "Ultrasound scan": "Available",
      Obstetrician: "From 2 pm",
    });
    expect(view.cards.map((c) => [c.insurer.name, c.answer])).toEqual([
      ["NHIS", "Yes"],
      ["Cosmopolitan Health", "Yes"],
      ["Prudential", "Unsure"],
    ]);
    expect(view.cards[0]!.badge.text).toBe("Confirmed by hospital 2 days ago");
    expect(view.cards[0]!.badge.history.month).toEqual({ accepted: 9, refused: 0 });
    expect(view.cards[0]!.topUps).toEqual(["Scan top-up about GH¢ 80 (3 patients, last 60 days)"]);
  });

  it("leaves out the distance when the page wasn't opened from a search", async () => {
    const db = fakeDb(pg, "anon");
    const detail = (await getFacilityDetail(db, AKOMA, now))!;
    expect(buildFacilityView({ detail, insurers: [], origin: null, cardSlug: null, now }).subtitle).toBe("Mission · Kaneshie");
  });
});

describe("whatChanged (screen 11, recalculated with rules B and T)", () => {
  const send = (body: Record<string, unknown>) =>
    submitReport({ db: fakeDb(pg, "owner"), body, secret: "s", now: new Date() });
  const changedAt = async (facilityId: string, reportId: string) => {
    const t = new Date();
    const detail = (await getFacilityDetail(fakeDb(pg, "anon"), facilityId, t))!;
    return whatChanged({ detail, insurerId: NHIS, cardName: "NHIS", reportId, now: t });
  };

  it("a new scan top-up at Akoma: the top-up line now counts 4 patients", async () => {
    const r = await send({ deviceId: "thanks-phone-1", facilityId: AKOMA, insurerId: NHIS, outcome: "topup", amountGhs: 80, item: "scan" });
    const change = await changedAt(AKOMA, r.status === "counted" ? r.reportId : "");
    expect(change).toMatchObject({
      kind: "topup",
      headline: "Scan top-up about GH¢ 80 (4 patients, last 60 days)",
      before: "Scan top-up about GH¢ 80 (3 patients, last 60 days)",
    });
  });

  it("a third refusal: the badge changes, and says what it was", async () => {
    const GBAWE = "f0000000-0000-4000-8000-000000000003";
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await send({ deviceId: `thanks-phone-refuse-${i}`, facilityId: GBAWE, insurerId: NHIS, outcome: "refused" });
      if (r.status === "counted") ids.push(r.reportId);
    }
    const change = await changedAt(GBAWE, ids[2]!);
    expect(change).toMatchObject({
      kind: "badge",
      headline: "NHIS · Listed, but 3 patients were refused in the last 30 days",
      before: "NHIS · On NHIA list, not checked yet. Call first",
    });
  });

  it("no visible change: the report is added to the history, and says so", async () => {
    const LAKESIDE = "f0000000-0000-4000-8000-000000000002";
    const r = await send({ deviceId: "thanks-phone-3", facilityId: LAKESIDE, insurerId: NHIS, outcome: "covered" });
    const change = await changedAt(LAKESIDE, r.status === "counted" ? r.reportId : "");
    expect(change).toMatchObject({ kind: "history", headline: "NHIS · 15 patients confirmed in the last 30 days" });
  });

  it("a report that isn't showing (held, or not found) changes nothing yet", async () => {
    expect(await changedAt(AKOMA, "00000000-0000-4000-8000-000000000000")).toEqual({ kind: "none" });
  });
});

describe("buildEmergency (screen 6, rule S2)", () => {
  const units = async () => {
    const db = fakeDb(pg, "anon");
    const t = new Date();
    return buildEmergency({
      candidates: await getEmergencyCandidates(db, { ...DANSOMAN, now: t }),
      insurers: await listInsurers(db),
      origin: DANSOMAN,
      now: t,
    });
  };

  it("lists Akoma and Westhills (accepting), then Pinecrest (full), within 15 km", async () => {
    const list = await units();
    expect(list.map((u) => [u.name, u.status.word, u.distanceKm])).toEqual([
      ["Akoma Mission Hospital", "Accepting", 1.8],
      ["Westhills District Hospital", "Accepting", 4.2],
      ["Pinecrest Specialist Hospital", "Full", 3.4],
    ]);
    expect(list[0]!.directionsUrl).toMatch(/google\.com\/maps\/dir/);
  });

  it("changing the card never changes emergency results (rules 3 and S2)", async () => {
    const list = await units();
    const names = { nhis: "NHIS", cosmopolitan: "Cosmopolitan Health", prudential: "Prudential" };
    const order = list.map((u) => u.id);
    for (const saved of [[], ["nhis"], ["cosmopolitan"], ["prudential"], ["nhis", "cosmopolitan"]]) {
      // The card only adds a note; the units and their order are built without it.
      const shown = list.map((u) => ({ id: u.id, note: cardNote(u.cardBadges, saved, names) }));
      expect(shown.map((s) => s.id)).toEqual(order);
      expect(shown).toHaveLength(3);
    }
    // Pinecrest refuses NHIS (B1) and is still listed.
    expect(list.map((u) => u.name)).toContain("Pinecrest Specialist Hospital");
  });

  it("the card note says what each saved card means there, in plain words", async () => {
    const list = await units();
    const names = { nhis: "NHIS", cosmopolitan: "Cosmopolitan Health" };
    const note = (name: string, saved: string[]) => cardNote(list.find((u) => u.name === name)!.cardBadges, saved, names);
    expect(note("Akoma Mission Hospital", ["nhis", "cosmopolitan"])).toBe("Takes your NHIS and Cosmopolitan Health cards");
    expect(note("Westhills District Hospital", ["nhis", "cosmopolitan"])).toBe("Takes your NHIS card · Cosmopolitan Health not checked");
    expect(note("Pinecrest Specialist Hospital", ["nhis"])).toBe("NHIS reported refused");
    expect(note("Akoma Mission Hospital", [])).toBeNull();
  });
});
