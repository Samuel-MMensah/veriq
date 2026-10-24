import { DAY_MS, HOUR_MS, MINUTE_MS, agoText, ageMs, formatAge, withinDays } from "./time";

const now = new Date("2026-10-22T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

describe("ageMs", () => {
  it("is how long ago a time was", () => {
    expect(ageMs(ago(5 * MINUTE_MS), now)).toBe(5 * MINUTE_MS);
  });

  it("treats a time in the future as just now", () => {
    expect(ageMs(new Date(now.getTime() + HOUR_MS).toISOString(), now)).toBe(0);
  });
});

describe("withinDays (the windows in rules B, T, A and K)", () => {
  it("includes the boundary: exactly 30 days ago is within 30 days", () => {
    expect(withinDays(ago(30 * DAY_MS), now, 30)).toBe(true);
    expect(withinDays(ago(30 * DAY_MS + 1), now, 30)).toBe(false);
  });
});

describe("agoText", () => {
  it("says 'just now' under a minute, otherwise '… ago'", () => {
    expect(agoText(59_000)).toBe("just now");
    expect(agoText(MINUTE_MS)).toBe("1 min ago");
    expect(agoText(2 * DAY_MS)).toBe("2 days ago");
  });
});

describe("formatAge (plain words, rule 9)", () => {
  it.each([
    [10 * 1000, "just now"],
    [MINUTE_MS, "1 min"],
    [40 * MINUTE_MS, "40 min"],
    [HOUR_MS, "1 h"],
    [23 * HOUR_MS + 59 * MINUTE_MS, "23 h"],
    [DAY_MS, "1 day"],
    [2 * DAY_MS, "2 days"],
    [15 * DAY_MS, "15 days"],
  ])("%i ms reads %s", (ms, text) => {
    expect(formatAge(ms)).toBe(text);
  });
});
