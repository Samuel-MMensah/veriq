import { matchAll, matchOne, indexPlaces, normalizeName, type OsmPlace } from "./osm";

const place = (osm: string, name: string, lat: number, lng: number): OsmPlace => ({ osm, name, lat, lng });
// Dansoman is in the old Ablekuma district; Dodowa is in Dangme West, far outside it.
const DANSOMAN = { lat: 5.561, lng: -0.26 };
const DODOWA = { lat: 5.88, lng: -0.1 };

describe("OpenStreetMap matching (Prompt 9, rule D1)", () => {
  it("normalises names: case, punctuation, CENTER, ST and LTD", () => {
    expect(normalizeName("St. John's Medical Center Ltd")).toBe("SAINT JOHNS MEDICAL CENTRE");
    expect(normalizeName("KORLE-BU  Polyclinic")).toBe("KORLE BU POLYCLINIC");
    expect(normalizeName("A & A Clinic")).toBe("A AND A CLINIC");
  });

  it("a confident match: same name, inside the district, one place", () => {
    const index = indexPlaces([place("node/1", "Dansoman polyclinic", DANSOMAN.lat, DANSOMAN.lng)]);
    expect(matchOne({ name: "DANSOMAN POLYCLINIC", district: "ABLEKUMA" }, index)).toEqual({
      location_source: "osm",
      lat: DANSOMAN.lat,
      lng: DANSOMAN.lng,
      osm: "node/1",
    });
  });

  it("the same name outside the district is not a match", () => {
    const index = indexPlaces([place("node/2", "Mawuena Pharmacy", DODOWA.lat, DODOWA.lng)]);
    expect(matchOne({ name: "MAWUENA PHARMACY", district: "ABLEKUMA" }, index)).toEqual({
      location_source: "none",
      reason: "on OpenStreetMap only outside its district",
    });
  });

  it("no place by that name is not a match; nothing is guessed from a similar name", () => {
    const index = indexPlaces([place("node/3", "Dansoman Polyclinic Annex", DANSOMAN.lat, DANSOMAN.lng)]);
    expect(matchOne({ name: "DANSOMAN POLYCLINIC", district: "ABLEKUMA" }, index).location_source).toBe("none");
  });

  it("two places with the name in the district, far apart, is not confident", () => {
    const index = indexPlaces([
      place("node/4", "Grace Clinic", 5.55, -0.26),
      place("node/5", "Grace Clinic", 5.6, -0.3),
    ]);
    expect(matchOne({ name: "GRACE CLINIC", district: "ABLEKUMA" }, index)).toEqual({
      location_source: "none",
      reason: "2 places with this name in its district",
    });
  });

  it("the same place mapped twice (under 300 m apart) is still one place", () => {
    const index = indexPlaces([
      place("node/6", "Grace Clinic", 5.55, -0.26),
      place("way/7", "Grace Clinic", 5.5505, -0.2605),
    ]);
    expect(matchOne({ name: "GRACE CLINIC", district: "ABLEKUMA" }, index).location_source).toBe("osm");
  });

  it("a name made only of general words is never matched", () => {
    const index = indexPlaces([place("node/8", "Diagnostic Centre", DANSOMAN.lat, DANSOMAN.lng)]);
    expect(matchOne({ name: "DIAGNOSTIC CENTRE", district: "ABLEKUMA" }, index)).toEqual({
      location_source: "none",
      reason: "name too general to match",
    });
  });

  it("an unknown district has no map area, so no match", () => {
    const index = indexPlaces([place("node/9", "A Clinic", DANSOMAN.lat, DANSOMAN.lng)]);
    expect(matchOne({ name: "A CLINIC", district: "NOWHERE" }, index)).toMatchObject({ location_source: "none" });
  });

  it("district names match in any case ('Ga' and 'GA')", () => {
    const index = indexPlaces([place("node/10", "Amasaman Clinic", 5.7, -0.3)]);
    expect(matchOne({ name: "AMASAMAN CLINIC", district: "Ga" }, index).location_source).toBe("osm");
  });

  it("one map place claimed by two facilities is confident for neither", () => {
    const places = [place("node/11", "Unity Clinic", 5.56, -0.25)];
    const got = matchAll(
      [
        { name: "UNITY CLINIC", district: "ABLEKUMA" },
        { name: "UNITY CLINIC", district: "OKAIKOI" },
      ],
      places,
    );
    expect(got.map((m) => m.location_source)).toEqual(["none", "none"]);
  });
});
