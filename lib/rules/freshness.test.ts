import { freshness } from "./freshness";
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
