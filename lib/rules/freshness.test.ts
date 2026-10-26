import { freshness, untilPassed } from "./freshness";
import { HOUR_MS, MINUTE_MS } from "./time";

const now = new Date("2026-10-22T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * HOUR_MS).toISOString();

describe("rule F: status freshness", () => {
  it("under 24 hours is shown normally with the time", () => {
    const f = freshness({ created_at: new Date(now.getTime() - 40 * MINUTE_MS).toISOString() }, now);
    expect(f).toMatchObject({ state: "fresh", warning: null, updatedText: "updated 40 min ago" });
  });

  it("just under 24 hours is still fresh (threshold)", () => {
    expect(freshness({ created_at: new Date(now.getTime() - 24 * HOUR_MS + 1).toISOString() }, now).state).toBe("fresh");
  });

  it("exactly 24 hours adds 'may have changed' (threshold)", () => {
    expect(freshness({ created_at: hoursAgo(24) }, now)).toMatchObject({ state: "aging", warning: "may have changed" });
  });

  it("exactly 72 hours still 'may have changed' (threshold)", () => {
    expect(freshness({ created_at: hoursAgo(72) }, now).state).toBe("aging");
  });

  it("over 72 hours is greyed: 'not updated recently' (threshold)", () => {
    const f = freshness({ created_at: new Date(now.getTime() - 72 * HOUR_MS - 1).toISOString() }, now);
    expect(f).toMatchObject({ state: "stale", warning: "not updated recently", greyed: true });
  });

  it("no row ever shows 'No update yet'", () => {
    expect(freshness(null, now)).toMatchObject({ state: "none", warning: "No update yet", updatedText: null, ageMs: null });
  });

  it("only stale is greyed", () => {
    expect(freshness({ created_at: hoursAgo(1) }, now).greyed).toBe(false);
    expect(freshness({ created_at: hoursAgo(30) }, now).greyed).toBe(false);
  });
});

describe("rule F: until_time", () => {
  // Accra is on UTC all year, so times of day read the same in UTC.
  const at = (iso: string) => new Date(iso);
  const row = { created_at: "2026-10-22T07:40:00Z", until_time: "16:00:00" };

  it("before the until_time the status is current", () => {
    expect(untilPassed(row, at("2026-10-22T15:59:00Z"))).toBe(false);
    expect(freshness(row, at("2026-10-22T15:59:00Z")).state).toBe("fresh");
  });

  it("at the until_time the status no longer counts as current (threshold)", () => {
    expect(untilPassed(row, at("2026-10-22T16:00:00Z"))).toBe(true);
    expect(freshness(row, at("2026-10-22T16:00:00Z"))).toMatchObject({ state: "ended", greyed: true });
  });

  it("the next morning it has still passed", () => {
    expect(untilPassed(row, at("2026-10-23T08:00:00Z"))).toBe(true);
  });

  it("an until_time earlier than the update means the next day (open till 2 am)", () => {
    const late = { created_at: "2026-10-22T20:00:00Z", until_time: "02:00:00" };
    expect(untilPassed(late, at("2026-10-22T23:30:00Z"))).toBe(false);
    expect(untilPassed(late, at("2026-10-23T02:00:00Z"))).toBe(true);
  });

  it("no until_time never passes", () => {
    expect(untilPassed({ created_at: "2026-10-22T07:40:00Z", until_time: null }, at("2026-10-25T08:00:00Z"))).toBe(false);
    expect(untilPassed({ created_at: "2026-10-22T07:40:00Z" }, at("2026-10-25T08:00:00Z"))).toBe(false);
  });

  it("a passed until_time wins over the age bands", () => {
    // 30 hours old would be "aging"; the until_time has passed, so it is "ended".
    expect(freshness(row, at("2026-10-23T13:40:00Z")).state).toBe("ended");
  });
});
