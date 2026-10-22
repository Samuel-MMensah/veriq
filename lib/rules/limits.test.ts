// @vitest-environment node
import { ALREADY_COUNTED_MESSAGE, checkReport, countsTowardRules, deviceHash } from "./limits";
import { DAY_MS, MINUTE_MS } from "./time";

const now = new Date("2026-10-22T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
const AKOMA = "akoma";
const OTHER = "pinecrest";

describe("rule A: device hash", () => {
  it("is SHA-256 hex of the device id and the server secret", () => {
    const h = deviceHash("device-123", "server-secret");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(deviceHash("device-123", "server-secret"));
  });

  it("changes with the secret, so the hash can't be rebuilt from the device id alone", () => {
    expect(deviceHash("device-123", "secret-a")).not.toBe(deviceHash("device-123", "secret-b"));
  });

  it("refuses an empty secret", () => {
    expect(() => deviceHash("device-123", "")).toThrow();
  });
});

describe("rule A: one report per device per facility per 7 days", () => {
  it("accepts the first report as live", () => {
    expect(checkReport({ facilityId: AKOMA, deviceReports: [], facilityReports: [], now })).toEqual({
      ok: true,
      state: "live",
    });
  });

  it("refuses a second report within 7 days, politely", () => {
    const result = checkReport({
      facilityId: AKOMA,
      deviceReports: [{ facility_id: AKOMA, created_at: ago(6 * DAY_MS) }],
      facilityReports: [],
      now,
    });
    expect(result).toEqual({ ok: false, reason: "already_counted", message: ALREADY_COUNTED_MESSAGE });
    expect(ALREADY_COUNTED_MESSAGE).toMatch(/already counted/i);
  });

  it("allows another report exactly 7 days later (threshold)", () => {
    const result = checkReport({
      facilityId: AKOMA,
      deviceReports: [{ facility_id: AKOMA, created_at: ago(7 * DAY_MS) }],
      facilityReports: [],
      now,
    });
    expect(result.ok).toBe(true);
  });

  it("refuses just under 7 days (threshold)", () => {
    const result = checkReport({
      facilityId: AKOMA,
      deviceReports: [{ facility_id: AKOMA, created_at: ago(7 * DAY_MS - 1) }],
      facilityReports: [],
      now,
    });
    expect(result.ok).toBe(false);
  });

  it("a report for another facility doesn't block", () => {
    const result = checkReport({
      facilityId: AKOMA,
      deviceReports: [{ facility_id: OTHER, created_at: ago(MINUTE_MS) }],
      facilityReports: [],
      now,
    });
    expect(result.ok).toBe(true);
  });
});

describe("rule A: burst holding", () => {
  const burst = (n: number, ageMs = 10 * MINUTE_MS) => Array.from({ length: n }, () => ({ created_at: ago(ageMs) }));

  it("the 10th report in an hour is still live (threshold)", () => {
    expect(checkReport({ facilityId: AKOMA, deviceReports: [], facilityReports: burst(9), now })).toEqual({
      ok: true,
      state: "live",
    });
  });

  it("more than 10 in an hour: the 11th is held (threshold)", () => {
    expect(checkReport({ facilityId: AKOMA, deviceReports: [], facilityReports: burst(10), now })).toEqual({
      ok: true,
      state: "held",
    });
  });

  it("reports older than an hour don't count toward the burst", () => {
    expect(checkReport({ facilityId: AKOMA, deviceReports: [], facilityReports: burst(20, 61 * MINUTE_MS), now })).toEqual({
      ok: true,
      state: "live",
    });
  });
});

describe("rule A: held and rejected never count", () => {
  it.each([
    ["live", true],
    ["held", false],
    ["rejected", false],
  ] as const)("%s counts: %s", (state, counts) => {
    expect(countsTowardRules(state)).toBe(counts);
  });
});
