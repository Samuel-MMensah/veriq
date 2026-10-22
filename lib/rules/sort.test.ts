import { sortEmergency, sortNoCard, sortResults, type EmergencyItem, type ResultItem } from "./sort";
import { HOUR_MS, MINUTE_MS } from "./time";

const now = new Date("2026-10-22T12:00:00Z");
const DANSOMAN = { lat: 5.545, lng: -0.265 };
const fresh = new Date(now.getTime() - 40 * MINUTE_MS).toISOString();
const stale = new Date(now.getTime() - 80 * HOUR_MS).toISOString();
/** A point about km kilometres north of Dansoman. */
const north = (km: number) => ({ lat: DANSOMAN.lat + km / 111.195, lng: DANSOMAN.lng });

function item(id: string, km: number, badge: ResultItem["badge"], status: ResultItem["status"] = "open", at = fresh): ResultItem {
  return { id, ...north(km), badge, status, statusUpdatedAt: status ? at : null };
}

describe("rule S1: results order", () => {
  it("sorts the demo: B2, B3, B4, then B1 last, whatever the distance", () => {
    const sorted = sortResults(
      [item("pinecrest", 1, "B1"), item("gbawe", 2, "B4"), item("lakeside", 3, "B3"), item("akoma", 4, "B2")],
      { origin: DANSOMAN, radiusKm: 5, now },
    );
    expect(sorted.map((r) => r.id)).toEqual(["akoma", "lakeside", "gbawe", "pinecrest"]);
  });

  it("leaves out B2x and B5", () => {
    const sorted = sortResults([item("a", 1, "B2x"), item("b", 1, "B5"), item("c", 1, "B4")], {
      origin: DANSOMAN,
      radiusKm: 5,
      now,
    });
    expect(sorted.map((r) => r.id)).toEqual(["c"]);
  });

  it("keeps facilities within the radius; exactly on the radius is in", () => {
    const edge = { id: "edge", ...north(5), badge: "B2" as const, status: null, statusUpdatedAt: null };
    const sorted = sortResults([edge, item("far", 5.2, "B2")], { origin: DANSOMAN, radiusKm: 5.0001, now });
    expect(sorted.map((r) => r.id)).toEqual(["edge"]);
  });

  it("within a badge: open or accepting, then unknown, then closed or full", () => {
    const sorted = sortResults(
      [
        item("closed", 1, "B3", "closed"),
        item("unknown", 2, "B3", null),
        item("open", 3, "B3", "open"),
        item("full", 0.5, "B3", "full"),
        item("accepting", 4, "B3", "accepting"),
      ],
      { origin: DANSOMAN, radiusKm: 5, now },
    );
    expect(sorted.map((r) => r.id)).toEqual(["open", "accepting", "unknown", "full", "closed"]);
  });

  it("a status over 72 hours old sorts as unknown (rule F)", () => {
    const sorted = sortResults([item("stale-open", 1, "B3", "open", stale), item("unknown", 2, "B3", null)], {
      origin: DANSOMAN,
      radiusKm: 5,
      now,
    });
    expect(sorted.map((r) => r.id)).toEqual(["stale-open", "unknown"]);
    expect(sorted[0]!.statusRank).toBe(sorted[1]!.statusRank);
  });

  it("then by distance, given to one decimal place", () => {
    const sorted = sortResults([item("b", 2.64, "B2"), item("a", 1.81, "B2")], { origin: DANSOMAN, radiusKm: 5, now });
    expect(sorted.map((r) => [r.id, r.distanceKm])).toEqual([
      ["a", 1.8],
      ["b", 2.6],
    ]);
  });

  it("keeps the caller's other fields", () => {
    const [r] = sortResults([{ ...item("a", 1, "B2"), name: "Akoma" }], { origin: DANSOMAN, radiusKm: 5, now });
    expect(r?.name).toBe("Akoma");
  });
});

describe("rule S2: emergency order", () => {
  const unit = (id: string, km: number, status: EmergencyItem["status"], at = fresh): EmergencyItem => ({
    id,
    ...north(km),
    status,
    statusUpdatedAt: status ? at : null,
  });

  it("sorts the demo: accepting by distance, then full", () => {
    const sorted = sortEmergency([unit("pinecrest", 3.4, "full"), unit("westhills", 4.2, "accepting"), unit("akoma", 1.8, "accepting")], {
      origin: DANSOMAN,
      now,
    });
    expect(sorted.map((r) => r.id)).toEqual(["akoma", "westhills", "pinecrest"]);
  });

  it("puts unknown and stale between accepting and full", () => {
    const sorted = sortEmergency(
      [unit("full", 1, "full"), unit("stale", 2, "accepting", stale), unit("unknown", 3, null), unit("accepting", 4, "accepting")],
      { origin: DANSOMAN, now },
    );
    expect(sorted.map((r) => r.id)).toEqual(["accepting", "stale", "unknown", "full"]);
  });

  it("keeps units within 15 km; leaves out units further away", () => {
    const sorted = sortEmergency([unit("near", 14.9, "accepting"), unit("far", 15.1, "accepting")], { origin: DANSOMAN, now });
    expect(sorted.map((r) => r.id)).toEqual(["near"]);
  });

  it("never filters or reorders by card (rules 3 and S2)", () => {
    const units = [unit("a", 1, "full"), unit("b", 2, "accepting"), unit("c", 3, null)];
    const withCards = units.map((u, i) => ({
      ...u,
      badge: (["B1", "B5", "B2x"] as const)[i],
      takesMyCard: i === 1,
      card: "nhis",
    }));
    const plain = sortEmergency(units, { origin: DANSOMAN, now }).map((r) => r.id);
    const carded = sortEmergency(withCards, { origin: DANSOMAN, now }).map((r) => r.id);
    expect(carded).toEqual(plain);
    expect(carded).toHaveLength(3); // B2x and B5 are not hidden here
  });
});

describe("No card/cash order (rule S1 without the badge step)", () => {
  const plain = (id: string, km: number, status: ResultItem["status"]) => ({
    id,
    ...north(km),
    status,
    statusUpdatedAt: status ? fresh : null,
  });

  it("keeps every facility in the radius, sorted by status then distance", () => {
    const sorted = sortNoCard([plain("closed", 1, "closed"), plain("open-far", 3, "open"), plain("unknown", 2, null), plain("open-near", 2.5, "open"), plain("far", 6, "open")], {
      origin: DANSOMAN,
      radiusKm: 5,
      now,
    });
    expect(sorted.map((r) => r.id)).toEqual(["open-near", "open-far", "unknown", "closed"]);
  });
});
