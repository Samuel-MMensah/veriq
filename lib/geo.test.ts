import { areaCell, cellCentre, haversineKm, roundKm } from "./geo";

const DANSOMAN = { lat: 5.545, lng: -0.265 };

describe("haversineKm (rules S1 and S2 distance)", () => {
  it("is zero for the same point", () => {
    expect(haversineKm(DANSOMAN, DANSOMAN)).toBe(0);
  });

  it("matches a known distance: one degree of latitude is about 111.2 km", () => {
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.195, 2);
  });

  it("gives the demo distances from Dansoman", () => {
    expect(roundKm(haversineKm(DANSOMAN, { lat: 5.55645, lng: -0.2535 }))).toBe(1.8); // Akoma
    expect(roundKm(haversineKm(DANSOMAN, { lat: 5.57373, lng: -0.25449 }))).toBe(3.4); // Pinecrest
  });

  it("is symmetric", () => {
    const a = { lat: 5.6, lng: -0.2 };
    expect(haversineKm(DANSOMAN, a)).toBeCloseTo(haversineKm(a, DANSOMAN), 10);
  });
});

describe("roundKm (rule S1: one decimal place)", () => {
  it("rounds to one decimal", () => {
    expect(roundKm(2.64)).toBe(2.6);
    expect(roundKm(2.65)).toBe(2.7);
    expect(roundKm(0.04)).toBe(0);
  });
});

describe("areaCell (rule K: cells of about 2 km)", () => {
  it("uses the south-west corner of a 0.02 degree cell, as in the seed", () => {
    expect(areaCell(5.545, -0.265)).toBe("5.54,-0.28"); // Dansoman
    expect(areaCell(5.63112, -0.02726)).toBe("5.62,-0.04"); // Ashaiman
    expect(areaCell(5.70442, -0.29324)).toBe("5.70,-0.30"); // Amasaman
  });

  it("puts a point exactly on a cell edge into that cell, despite floating point", () => {
    expect(areaCell(5.54, -0.28)).toBe("5.54,-0.28");
    expect(areaCell(5.56, -0.26)).toBe("5.56,-0.26");
  });

  it("finds the cell centre", () => {
    const c = cellCentre("5.54,-0.28");
    expect(c.lat).toBeCloseTo(5.55, 10);
    expect(c.lng).toBeCloseTo(-0.27, 10);
  });

  it("rejects a malformed cell", () => {
    expect(() => cellCentre("nowhere")).toThrow();
  });
});
