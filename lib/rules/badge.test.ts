import { badge, verdict, type BadgeLink, type BadgeReport } from "./badge";
import { DAY_MS } from "./time";

const now = new Date("2026-10-22T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * DAY_MS).toISOString();

function reports(outcome: BadgeReport["outcome"], ...ages: number[]): BadgeReport[] {
  return ages.map((d) => ({ outcome, created_at: daysAgo(d) }));
}

const listed: BadgeLink = { listed_by: "nhia", hospital_says: null, hospital_confirmed_at: null };

describe("rule B1: reported refused", () => {
  it("at least 3 refusals newer than the hospital's answer, more refused than accepted", () => {
    const link: BadgeLink = { listed_by: "nhia", hospital_says: "accepts", hospital_confirmed_at: daysAgo(12) };
    const result = badge({ link, reports: reports("refused", 1, 4, 8, 14, 16, 20), now });
    // 3 refusals since the answer trigger B1; the text counts all 6 in the last 30 days (history kept).
    expect(result).toMatchObject({ id: "B1", count: 6, inCardSearch: true, tone: "refused" });
    expect(result.text).toBe("Listed, but 6 patients were refused in the last 30 days");
  });

  it("exactly 3 refusals is enough (threshold)", () => {
    expect(badge({ link: listed, reports: reports("refused", 1, 2, 3), now }).id).toBe("B1");
  });

  it("2 refusals is not enough (threshold)", () => {
    expect(badge({ link: listed, reports: reports("refused", 1, 2), now }).id).toBe("B4");
  });

  it("refusals before the hospital's answer don't count", () => {
    const link: BadgeLink = { listed_by: "nhia", hospital_says: "accepts", hospital_confirmed_at: daysAgo(5) };
    expect(badge({ link, reports: reports("refused", 6, 7, 8, 9), now }).id).toBe("B2");
  });

  it("needs more refused than accepted: 3 refused and 3 accepted is not B1", () => {
    const r = [...reports("refused", 1, 2, 3), ...reports("covered", 1, 2), ...reports("topup", 3)];
    expect(badge({ link: listed, reports: r, now }).id).not.toBe("B1");
  });

  it("4 refused and 3 accepted is B1", () => {
    const r = [...reports("refused", 1, 2, 3, 4), ...reports("covered", 1, 2, 3)];
    expect(badge({ link: listed, reports: r, now }).id).toBe("B1");
  });

  it("refusals older than 30 days don't count; exactly 30 days still does", () => {
    expect(badge({ link: listed, reports: reports("refused", 31, 32, 33), now }).id).toBe("B4");
    expect(badge({ link: listed, reports: reports("refused", 1, 2, 30), now }).id).toBe("B1");
  });

  it("wins over a fresh hospital confirmation (checked first)", () => {
    const link: BadgeLink = { listed_by: "nhia", hospital_says: "accepts", hospital_confirmed_at: daysAgo(10) };
    expect(badge({ link, reports: reports("refused", 1, 2, 3), now }).id).toBe("B1");
  });

  it("new refusals don't disappear behind older accepted reports (team decision 2026-10-22)", () => {
    const link: BadgeLink = { listed_by: "nhia", hospital_says: "accepts", hospital_confirmed_at: daysAgo(6) };
    const r = [...reports("covered", 10, 12, 14, 16, 18), ...reports("refused", 1, 3, 5)];
    const result = badge({ link, reports: r, now });
    expect(result).toMatchObject({ id: "B1", count: 3 });
    // The older accepted reports stay visible in the history.
    expect(result.history.month).toEqual({ accepted: 5, refused: 3 });
  });

  it("works with no row at all for the pair", () => {
    expect(badge({ link: null, reports: reports("refused", 1, 2, 3), now }).id).toBe("B1");
  });
});

describe("rule B2: hospital confirmed", () => {
  it("accepts, confirmed 2 days ago", () => {
    const link: BadgeLink = { listed_by: "none", hospital_says: "accepts", hospital_confirmed_at: daysAgo(2) };
    const result = badge({ link, reports: [], now });
    expect(result).toMatchObject({ id: "B2", tone: "hospital", inCardSearch: true });
    expect(result.text).toBe("Confirmed by hospital 2 days ago");
  });

  it("confirmed under a minute ago reads 'just now'", () => {
    const link: BadgeLink = { listed_by: "none", hospital_says: "accepts", hospital_confirmed_at: new Date(now.getTime() - 5000).toISOString() };
    expect(badge({ link, reports: [], now }).text).toBe("Confirmed by hospital just now");
  });

  it("partial adds 'with top-ups'", () => {
    const link: BadgeLink = { listed_by: "insurer", hospital_says: "partial", hospital_confirmed_at: daysAgo(3) };
    expect(badge({ link, reports: [], now }).text).toBe("Confirmed by hospital 3 days ago with top-ups");
  });

  it("exactly 14 days old still counts (threshold)", () => {
    const link: BadgeLink = { listed_by: "nhia", hospital_says: "accepts", hospital_confirmed_at: daysAgo(14) };
    expect(badge({ link, reports: [], now }).id).toBe("B2");
  });

  it("just over 14 days falls through to the next rule (threshold)", () => {
    const link: BadgeLink = {
      listed_by: "nhia",
      hospital_says: "accepts",
      hospital_confirmed_at: new Date(now.getTime() - 14 * DAY_MS - 1).toISOString(),
    };
    expect(badge({ link, reports: [], now }).id).toBe("B4");
  });

  it("an old answer with 3 accepted reports becomes B3", () => {
    const link: BadgeLink = { listed_by: "insurer", hospital_says: "accepts", hospital_confirmed_at: daysAgo(20) };
    expect(badge({ link, reports: reports("covered", 4, 9, 16), now }).id).toBe("B3");
  });
});

describe("rule B2x: hospital says no", () => {
  it("does_not within 14 days is left out of card searches", () => {
    const link: BadgeLink = { listed_by: "nhia", hospital_says: "does_not", hospital_confirmed_at: daysAgo(5) };
    const result = badge({ link, reports: reports("covered", 1, 2, 3), now });
    expect(result).toMatchObject({ id: "B2x", inCardSearch: false, text: "Not accepted (hospital)" });
  });

  it("exactly 14 days still counts (threshold)", () => {
    const link: BadgeLink = { listed_by: "none", hospital_says: "does_not", hospital_confirmed_at: daysAgo(14) };
    expect(badge({ link, reports: [], now }).id).toBe("B2x");
  });

  it("older than 14 days falls through", () => {
    const link: BadgeLink = { listed_by: "nhia", hospital_says: "does_not", hospital_confirmed_at: daysAgo(15) };
    expect(badge({ link, reports: [], now }).id).toBe("B4");
  });
});

describe("rule B3: patients confirmed", () => {
  it("14 accepted this month", () => {
    const ages = Array.from({ length: 14 }, (_, i) => i + 1);
    const result = badge({ link: listed, reports: reports("covered", ...ages), now });
    expect(result).toMatchObject({ id: "B3", count: 14, tone: "patients", inCardSearch: true });
    expect(result.text).toBe("14 patients confirmed in the last 30 days");
  });

  it("exactly 3 accepted is enough (threshold); top-ups count as accepted", () => {
    const r = [...reports("covered", 1, 2), ...reports("topup", 3)];
    expect(badge({ link: null, reports: r, now })).toMatchObject({ id: "B3", count: 3 });
  });

  it("2 accepted is not enough (threshold)", () => {
    expect(badge({ link: listed, reports: reports("covered", 1, 2), now }).id).toBe("B4");
  });

  it("needs more accepted than refused", () => {
    const r = [...reports("covered", 1, 2, 3), ...reports("refused", 4, 5, 6)];
    expect(badge({ link: listed, reports: r, now }).id).toBe("B4");
  });
});

describe("rule B4: on a list, not checked", () => {
  it("NHIA list", () => {
    const result = badge({ link: listed, reports: [], now });
    expect(result).toMatchObject({ id: "B4", tone: "unchecked", inCardSearch: true });
    expect(result.text).toBe("On NHIA list, not checked yet. Call first");
  });

  it("insurer list", () => {
    const link: BadgeLink = { listed_by: "insurer", hospital_says: null, hospital_confirmed_at: null };
    expect(badge({ link, reports: [], now }).text).toBe("On insurer list, not checked yet. Call first");
  });
});

describe("rule B5: unknown", () => {
  it("no row, no reports", () => {
    expect(badge({ link: null, reports: [], now })).toMatchObject({ id: "B5", inCardSearch: false, tone: "unknown" });
  });

  it("not on a list and too few reports", () => {
    const link: BadgeLink = { listed_by: "none", hospital_says: null, hospital_confirmed_at: null };
    expect(badge({ link, reports: reports("covered", 1), now }).id).toBe("B5");
  });
});

describe("every badge carries its history (team decision 2026-10-22)", () => {
  it("counts the week, the 30 days and the year, whatever the badge", () => {
    const r = [...reports("covered", 2, 20, 100), ...reports("refused", 40)];
    expect(badge({ link: listed, reports: r, now }).history).toEqual({
      week: { accepted: 1, refused: 0 },
      month: { accepted: 2, refused: 0 },
      year: { accepted: 3, refused: 1 },
    });
  });
});

describe("held and rejected reports never count (rule A)", () => {
  it("ignores reports that are not live", () => {
    const r: BadgeReport[] = [
      ...reports("refused", 1, 2),
      { outcome: "refused", created_at: daysAgo(1), state: "held" },
      { outcome: "refused", created_at: daysAgo(1), state: "rejected" },
    ];
    expect(badge({ link: listed, reports: r, now }).id).toBe("B4");
  });
});

describe("rule B worded as an answer (verdict)", () => {
  it("B2 and B3 say the card is taken", () => {
    expect(verdict("B2", "NHIS")).toEqual({ short: "Yes", headline: "Takes NHIS" });
    expect(verdict("B3", "NHIS")).toEqual({ short: "Yes", headline: "Takes NHIS" });
  });

  it("B4 never claims the card is taken: only a list says so", () => {
    expect(verdict("B4", "NHIS")).toEqual({ short: "Unsure", headline: "NHIS not confirmed yet" });
  });

  it("B1 names patients as the source of the refusals", () => {
    expect(verdict("B1", "NHIS")).toEqual({ short: "Refused", headline: "Patients report NHIS refusals" });
  });

  it("B2x and B5", () => {
    expect(verdict("B2x", "Prudential")).toEqual({ short: "No", headline: "Does not take Prudential" });
    expect(verdict("B5", "Prudential")).toEqual({ short: "Unknown", headline: "No Prudential information" });
  });

  it("follows the badge: a 3rd refusal turns 'Takes' into 'Patients report' (rules B1, B2)", () => {
    const link: BadgeLink = { listed_by: "nhia", hospital_says: "accepts", hospital_confirmed_at: daysAgo(5) };
    expect(verdict(badge({ link, reports: reports("refused", 1, 2), now }).id, "NHIS").headline).toBe("Takes NHIS");
    expect(verdict(badge({ link, reports: reports("refused", 1, 2, 3), now }).id, "NHIS").headline).toBe(
      "Patients report NHIS refusals",
    );
  });
});
