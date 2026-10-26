import { parseLocation } from "./location";

describe("parseLocation (/admin, rule D1: location_source = admin)", () => {
  it("reads 'lat, lng' as copied from a map", () => {
    expect(parseLocation("5.5612, -0.2601")).toEqual({ ok: true, lat: 5.5612, lng: -0.2601 });
    expect(parseLocation(" 5.5612 -0.2601 ")).toEqual({ ok: true, lat: 5.5612, lng: -0.2601 });
  });

  it("refuses a point outside Greater Accra (swapped or missing minus)", () => {
    expect(parseLocation("-0.2601, 5.5612").ok).toBe(false);
    expect(parseLocation("5.5612, 0.2601").ok).toBe(true); // east of Tema is still the region
    expect(parseLocation("5.5612, -1.2601").ok).toBe(false);
  });

  it("refuses anything that isn't two numbers", () => {
    expect(parseLocation("").ok).toBe(false);
    expect(parseLocation("Dansoman").ok).toBe(false);
    expect(parseLocation("5.5, -0.2, 3").ok).toBe(false);
  });
});
