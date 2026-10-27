import { demoUntilTime } from "./demo-time";

// Accra is on UTC all year, so these UTC times are Accra times.
const at = (hhmm: string) => new Date(`2026-10-27T${hhmm}:00Z`);

describe("demo till time on reset (rules F and 1, demo data only)", () => {
  it("a reset at 07:00 gives 12:00: reset + 4 h is 11:00, and it is never earlier than noon", () => {
    expect(demoUntilTime(at("07:00"))).toBe("12:00:00");
  });

  it("a reset at 11:00 gives 15:00 (reset + 4 hours)", () => {
    expect(demoUntilTime(at("11:00"))).toBe("15:00:00");
  });

  it("a reset at 18:00 gives 20:00: reset + 4 h is 22:00, and it is never later than 8 pm", () => {
    expect(demoUntilTime(at("18:00"))).toBe("20:00:00");
  });

  it("a reset at 21:23 gives no till time: just 'Open'", () => {
    expect(demoUntilTime(at("21:23"))).toBeNull();
  });

  it("a reset at 23:59 gives no till time: just 'Open'", () => {
    expect(demoUntilTime(at("23:59"))).toBeNull();
  });

  it("from 19:00 exactly there is no till time (threshold)", () => {
    expect(demoUntilTime(at("18:59"))).toBe("20:00:00");
    expect(demoUntilTime(at("19:00"))).toBeNull();
  });

  it("reset + 4 hours goes to the nearest hour", () => {
    expect(demoUntilTime(at("10:29"))).toBe("14:00:00");
    expect(demoUntilTime(at("10:30"))).toBe("15:00:00");
  });

  it("an early-morning reset still reads as a daytime clinic (never 'till 1 am')", () => {
    expect(demoUntilTime(at("00:30"))).toBe("12:00:00");
    expect(demoUntilTime(at("03:00"))).toBe("12:00:00");
  });

  it("whenever there is a till time, it is between 12:00 and 20:00 and after the reset", () => {
    for (let minutes = 0; minutes < 24 * 60; minutes += 7) {
      const reset = new Date(Date.UTC(2026, 9, 27, 0, minutes));
      const till = demoUntilTime(reset);
      if (till === null) {
        expect(reset.getUTCHours()).toBeGreaterThanOrEqual(19);
        continue;
      }
      const [h, m] = till.split(":").map(Number);
      const tillMinutes = h! * 60 + m!;
      expect(tillMinutes).toBeGreaterThanOrEqual(12 * 60);
      expect(tillMinutes).toBeLessThanOrEqual(20 * 60);
      expect(tillMinutes).toBeGreaterThan(reset.getUTCHours() * 60 + reset.getUTCMinutes());
    }
  });
});
