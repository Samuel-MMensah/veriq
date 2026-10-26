import { displayName, displayPlace } from "./names";

describe("displayName (rule 9: plain to read; rule D1: same words)", () => {
  it("reads capitals in title case", () => {
    expect(displayName("DANSOMAN POLYCLINIC")).toBe("Dansoman Polyclinic");
    expect(displayName("1ST FOUNDATION CLINIC")).toBe("1st Foundation Clinic");
  });

  it("keeps each part of a joined word", () => {
    expect(displayName("KORLE-BU POLYCLINIC")).toBe("Korle-Bu Polyclinic");
    expect(displayName("ROYAL STAR CLINIC & DIAGNOSTIC CENTRE")).toBe("Royal Star Clinic & Diagnostic Centre");
  });

  it("keeps short forms in capitals and small words in lower case", () => {
    expect(displayName("GBC CLINIC")).toBe("GBC Clinic");
    expect(displayName("LEKMA HOSPITAL")).toBe("LEKMA Hospital");
    expect(displayName("HOUSE OF GRACE CLINIC")).toBe("House of Grace Clinic");
  });

  it("leaves mixed-case names (the demo hospitals) as they are", () => {
    expect(displayName("Akoma Mission Hospital")).toBe("Akoma Mission Hospital");
  });

  it("only changes case: the letters are the file's own", () => {
    const name = "ADWOA BOATEMAA MEMORIAL CLINIC";
    expect(displayName(name).toUpperCase()).toBe(name);
  });

  it("displayPlace keeps a missing place missing", () => {
    expect(displayPlace(null)).toBeNull();
    expect(displayPlace("OSU KLOTTEY")).toBe("Osu Klottey");
  });
});
