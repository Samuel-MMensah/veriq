// @vitest-environment node
import { DEMO_ACCOUNTS, SESSION_HOURS, makeSession, readSession } from "./demo";

const now = new Date("2026-10-24T07:00:00Z");
const SECRET = "session-test-secret";

describe("demo staff session (Phase 1 demo login)", () => {
  it("signs in the Akoma hospital account and the NHIS insurer account", () => {
    expect(readSession(makeSession("hospital-akoma", SECRET, now), SECRET, now)).toMatchObject({
      role: "hospital",
      facilityId: "f0000000-0000-4000-8000-000000000001",
    });
    expect(readSession(makeSession("insurer-nhis", SECRET, now), SECRET, now)).toMatchObject({
      role: "insurer",
      insurerId: "a0000000-0000-4000-8000-000000000001",
    });
  });

  it("refuses an altered cookie, for example one switched to another account", () => {
    const cookie = makeSession("insurer-nhis", SECRET, now);
    const [, mac] = cookie.split(".");
    const forged = `${Buffer.from(JSON.stringify({ key: "hospital-akoma", exp: now.getTime() + 1e9 })).toString("base64url")}.${mac}`;
    expect(readSession(forged, SECRET, now)).toBeNull();
    expect(readSession(`${cookie}x`, SECRET, now)).toBeNull();
  });

  it("refuses a cookie signed with another secret, or no secret", () => {
    expect(readSession(makeSession("hospital-akoma", "other", now), SECRET, now)).toBeNull();
    expect(readSession(makeSession("hospital-akoma", SECRET, now), "", now)).toBeNull();
    expect(() => makeSession("hospital-akoma", "", now)).toThrow();
  });

  it(`expires after ${SESSION_HOURS} hours`, () => {
    const cookie = makeSession("hospital-akoma", SECRET, now);
    expect(readSession(cookie, SECRET, new Date(now.getTime() + SESSION_HOURS * 3600_000 - 1))).not.toBeNull();
    expect(readSession(cookie, SECRET, new Date(now.getTime() + SESSION_HOURS * 3600_000))).toBeNull();
  });

  it("refuses junk", () => {
    expect(readSession(undefined, SECRET, now)).toBeNull();
    expect(readSession("not-a-cookie", SECRET, now)).toBeNull();
  });

  it("demo phone numbers are deliberately invalid", () => {
    for (const a of DEMO_ACCOUNTS) expect(a.phone).toMatch(/^\+2330000/);
  });
});
