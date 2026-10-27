import {
  demoModeFrom,
  hasLocation,
  isPharmacy,
  reportsLive,
  reportsOpen,
  servicesNotListed,
  servicesNotListedApplies,
  showSampleTag,
  sourceLine,
  visibleInMode,
  type NotListedItem,
} from "./directory";

const DANSOMAN = { lat: 5.545, lng: -0.265 };
/** A point about km kilometres north of Dansoman. */
const north = (km: number) => ({ lat: DANSOMAN.lat + km / 111.195, lng: DANSOMAN.lng });

function real(id: string, km: number | null, nhiaType = "CLINIC", hasServices = false): NotListedItem {
  const at = km === null ? { lat: null, lng: null } : north(km);
  return { id, source: "nhia", nhiaType, hasServices, locationSource: km === null ? "none" : "osm", ...at };
}

describe("rule D1: directory facts", () => {
  it("names the source and month: 'From the NHIA list, October 2026'", () => {
    expect(sourceLine({ source: "nhia", source_date: "2026-10-26" })).toBe("From the NHIA list, October 2026");
  });

  it("uses the month of the source date, not today's", () => {
    expect(sourceLine({ source: "nhia", source_date: "2027-01-31" })).toBe("From the NHIA list, January 2027");
  });

  it("demo facilities have no directory source line", () => {
    expect(sourceLine({ source: "demo", source_date: null })).toBeNull();
  });

  it("a real facility with no source date still names the list, with no invented month", () => {
    expect(sourceLine({ source: "nhia", source_date: null })).toBe("From the NHIA list");
  });

  it("location_source none is left out of distance searches", () => {
    expect(hasLocation({ location_source: "none", lat: null, lng: null })).toBe(false);
    expect(hasLocation({ location_source: "osm", lat: 5.5, lng: -0.2 })).toBe(true);
    expect(hasLocation({ location_source: "admin", lat: 5.5, lng: -0.2 })).toBe(true);
  });

  it("a location source without coordinates is still no location", () => {
    expect(hasLocation({ location_source: "osm", lat: null, lng: null })).toBe(false);
  });
});

describe("rule D2: demo separation", () => {
  it("demo facilities show only in demo mode", () => {
    expect(visibleInMode({ source: "demo" }, true)).toBe(true);
    expect(visibleInMode({ source: "demo" }, false)).toBe(false);
  });

  it("real facilities show outside demo mode", () => {
    expect(visibleInMode({ source: "nhia" }, false)).toBe(true);
  });

  it("demo mode shows the demo story only, so real hospitals don't mix with invented ones", () => {
    expect(visibleInMode({ source: "nhia" }, true)).toBe(false);
  });
});

describe("rule 1: SAMPLE DATA tag", () => {
  it("shows while a demo facility is on the screen", () => {
    expect(showSampleTag([{ source: "nhia" }, { source: "demo" }])).toBe(true);
  });

  it("does not show for real facilities only", () => {
    expect(showSampleTag([{ source: "nhia" }, { source: "nhia" }])).toBe(false);
  });

  it("does not show on a screen with no facility", () => {
    expect(showSampleTag([])).toBe(false);
  });
});

describe("rule D3: services not listed", () => {
  it("applies to NHIS and No card / cash, not to a private card", () => {
    expect(servicesNotListedApplies({ cardSlug: "nhis", insurerKind: "public" })).toBe(true);
    expect(servicesNotListedApplies({ cardSlug: "cash", insurerKind: null })).toBe(true);
    expect(servicesNotListedApplies({ cardSlug: "cosmopolitan", insurerKind: "private" })).toBe(false);
    expect(servicesNotListedApplies({ cardSlug: "prudential", insurerKind: "private" })).toBe(false);
  });

  it("sorts by distance only", () => {
    const got = servicesNotListed([real("far", 3), real("near", 1), real("mid", 2)], { origin: DANSOMAN, radiusKm: 5 });
    expect(got.map((g) => g.id)).toEqual(["near", "mid", "far"]);
    expect(got[0]!.distanceKm).toBe(1);
  });

  it("never lists a pharmacy or chemical shop", () => {
    const got = servicesNotListed([real("p", 1, "Pharmacy"), real("c", 1, "Chemical Shop"), real("k", 1, "CLINIC")], {
      origin: DANSOMAN,
      radiusKm: 5,
    });
    expect(got.map((g) => g.id)).toEqual(["k"]);
  });

  it("leaves out facilities with confirmed services (they are searched by rule S1)", () => {
    const got = servicesNotListed([real("listed", 1, "CLINIC", true), real("none", 2)], { origin: DANSOMAN, radiusKm: 5 });
    expect(got.map((g) => g.id)).toEqual(["none"]);
  });

  it("leaves out demo facilities", () => {
    const demo: NotListedItem = { ...real("demo", 1), source: "demo" };
    expect(servicesNotListed([demo], { origin: DANSOMAN, radiusKm: 5 })).toEqual([]);
  });

  it("leaves out facilities with no location (rule D1)", () => {
    expect(servicesNotListed([real("lost", null)], { origin: DANSOMAN, radiusKm: 5 })).toEqual([]);
  });

  it("keeps the search radius; exactly on the radius is in", () => {
    const got = servicesNotListed([real("edge", 5), real("out", 5.2)], { origin: DANSOMAN, radiusKm: 5.0001 });
    expect(got.map((g) => g.id)).toEqual(["edge"]);
  });

  it("never guesses a service from the type: a dental clinic shows for any service search", () => {
    const got = servicesNotListed([real("dent", 1, "DENTAL")], { origin: DANSOMAN, radiusKm: 5 });
    expect(got.map((g) => g.id)).toEqual(["dent"]);
  });

  it("does not read a payment or plan field (rule 5)", () => {
    const paid = { ...real("paid", 3), plan: "gold", paid: true } as NotListedItem;
    const got = servicesNotListed([paid, real("free", 1)], { origin: DANSOMAN, radiusKm: 5 });
    expect(got.map((g) => g.id)).toEqual(["free", "paid"]);
  });
});

describe("pharmacy types (rule D3 and S2)", () => {
  it("matches the file's wording in any case", () => {
    expect(isPharmacy("Pharmacy")).toBe(true);
    expect(isPharmacy("PHARMACY")).toBe(true);
    expect(isPharmacy("Chemical Shop")).toBe(true);
    expect(isPharmacy("CLINIC")).toBe(false);
    expect(isPharmacy(null)).toBe(false);
  });
});

describe("rule R1: reports on real facilities", () => {
  it("REPORTS_LIVE=off closes reports on real facilities", () => {
    expect(reportsOpen({ source: "nhia" }, reportsLive("off"))).toBe(false);
  });

  it("demo facilities keep reporting", () => {
    expect(reportsOpen({ source: "demo" }, reportsLive("off"))).toBe(true);
  });

  it("REPORTS_LIVE=on opens reports on real facilities", () => {
    expect(reportsOpen({ source: "nhia" }, reportsLive("on"))).toBe(true);
  });

  it("unset or anything but 'on' counts as off, so reports never open by mistake", () => {
    expect(reportsLive(undefined)).toBe(false);
    expect(reportsLive("")).toBe(false);
    expect(reportsLive("yes")).toBe(false);
    expect(reportsLive(" ON ")).toBe(true);
  });
});

describe("rule D2: demo mode", () => {
  it("is off for a member of the public", () => {
    expect(demoModeFrom({ param: undefined, demoCookie: undefined, staffSignedIn: false })).toBe(false);
  });

  it("?demo=1 turns it on, and its cookie keeps it on", () => {
    expect(demoModeFrom({ param: "1", demoCookie: undefined, staffSignedIn: false })).toBe(true);
    expect(demoModeFrom({ param: undefined, demoCookie: "1", staffSignedIn: false })).toBe(true);
  });

  it("the demo login cookie turns it on", () => {
    expect(demoModeFrom({ param: undefined, demoCookie: undefined, staffSignedIn: true })).toBe(true);
  });

  it("?demo=0 turns it off, even with a cookie", () => {
    expect(demoModeFrom({ param: "0", demoCookie: "1", staffSignedIn: true })).toBe(false);
  });

  it("any other value of the cookie or the parameter changes nothing", () => {
    expect(demoModeFrom({ param: "yes", demoCookie: "true", staffSignedIn: false })).toBe(false);
  });
});

describe("rule D2: the demo deployment (VERIQ_DEMO_SITE=on)", () => {
  const site = { demoSite: true };

  it("opens in demo mode with no parameter, cookie or login", () => {
    expect(demoModeFrom({ param: undefined, demoCookie: undefined, staffSignedIn: false, ...site })).toBe(true);
  });

  it("?demo=0 still turns it off, and its cookie ('0') keeps it off on later screens", () => {
    expect(demoModeFrom({ param: "0", demoCookie: undefined, staffSignedIn: false, ...site })).toBe(false);
    expect(demoModeFrom({ param: undefined, demoCookie: "0", staffSignedIn: false, ...site })).toBe(false);
  });

  it("?demo=1 after ?demo=0 turns it back on", () => {
    expect(demoModeFrom({ param: "1", demoCookie: "0", staffSignedIn: false, ...site })).toBe(true);
  });

  it("the real site never opens in demo mode by itself, and an 'off' cookie changes nothing there", () => {
    expect(demoModeFrom({ param: undefined, demoCookie: undefined, staffSignedIn: false, demoSite: false })).toBe(false);
    expect(demoModeFrom({ param: undefined, demoCookie: "0", staffSignedIn: false })).toBe(false);
  });
});
