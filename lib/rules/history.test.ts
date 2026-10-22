import { PERIOD_LABEL, reportHistory } from "./history";
import { DAY_MS } from "./time";

const now = new Date("2026-10-22T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * DAY_MS).toISOString();

describe("report history: last 7 days, 30 days and 12 months (team decision 2026-10-22)", () => {
  const reports = [
    { outcome: "covered" as const, created_at: daysAgo(1) },
    { outcome: "topup" as const, created_at: daysAgo(7) }, // exactly 7 days: in the week
    { outcome: "refused" as const, created_at: daysAgo(8) },
    { outcome: "refused" as const, created_at: daysAgo(30) }, // exactly 30 days: in the month
    { outcome: "covered" as const, created_at: daysAgo(200) },
    { outcome: "refused" as const, created_at: daysAgo(365) }, // exactly 365 days: in the year
    { outcome: "refused" as const, created_at: daysAgo(366) }, // older than a year
  ];

  it("counts accepted (covered and top-up) and refused in each period, boundaries included", () => {
    expect(reportHistory(reports, now)).toEqual({
      week: { accepted: 2, refused: 0 },
      month: { accepted: 2, refused: 2 },
      year: { accepted: 3, refused: 3 },
    });
  });

  it("keeps held and rejected out of the counts (rule A)", () => {
    const h = reportHistory(
      [
        { outcome: "refused", created_at: daysAgo(1), state: "held" },
        { outcome: "refused", created_at: daysAgo(1), state: "rejected" },
      ],
      now,
    );
    expect(h.year).toEqual({ accepted: 0, refused: 0 });
  });

  it("names each period in plain words", () => {
    expect(PERIOD_LABEL).toEqual({ week: "last 7 days", month: "last 30 days", year: "last 12 months" });
  });
});
