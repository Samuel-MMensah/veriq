import { median, roundToNearest5, topUps, type TopUpReport, type TopUpResponse } from "./topup";
import { DAY_MS } from "./time";

const now = new Date("2026-10-22T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * DAY_MS).toISOString();

const scan = (amount: number, age: number): TopUpReport => ({
  outcome: "topup",
  item: "scan",
  amount_ghs: amount,
  created_at: daysAgo(age),
});

describe("rule T helpers", () => {
  it("median of odd and even lists", () => {
    expect(median([80, 75, 85])).toBe(80);
    expect(median([50, 60])).toBe(55);
  });

  it("rounds to the nearest 5", () => {
    expect(roundToNearest5(77)).toBe(75);
    expect(roundToNearest5(77.5)).toBe(80);
    expect(roundToNearest5(82)).toBe(80);
    expect(roundToNearest5(83)).toBe(85);
  });
});

describe("rule T: top-ups", () => {
  it("3 scan top-ups of GH¢ 80 show 'Scan top-up about GH¢ 80'", () => {
    const [t] = topUps({ reports: [scan(80, 1), scan(80, 3), scan(80, 5)], responses: [], now });
    expect(t).toMatchObject({ item: "scan", amountGhs: 80, source: "patients", reportCount: 3 });
    expect(t?.text).toBe("Scan top-up about GH¢ 80 (3 patients, last 60 days)");
  });

  it("exactly 2 reports is enough (threshold)", () => {
    expect(topUps({ reports: [scan(50, 1), scan(60, 2)], responses: [], now })[0]?.amountGhs).toBe(55);
  });

  it("1 report is not enough (threshold)", () => {
    expect(topUps({ reports: [scan(80, 1)], responses: [], now })).toEqual([]);
  });

  it("uses the median, rounded to the nearest 5", () => {
    expect(topUps({ reports: [scan(72, 1), scan(78, 2), scan(200, 3)], responses: [], now })[0]?.amountGhs).toBe(80);
  });

  it("only counts the last 60 days; exactly 60 days still counts", () => {
    expect(topUps({ reports: [scan(80, 61), scan(80, 70)], responses: [], now })).toEqual([]);
    expect(topUps({ reports: [scan(80, 60), scan(80, 1)], responses: [], now })).toHaveLength(1);
  });

  it("is per item", () => {
    const drugs: TopUpReport = { outcome: "topup", item: "drugs", amount_ghs: 30, created_at: daysAgo(1) };
    const result = topUps({ reports: [scan(80, 1), scan(80, 2), drugs], responses: [], now });
    expect(result.map((t) => t.item)).toEqual(["scan"]);
  });

  it("ignores covered and refused reports, reports with no amount or item, and non-live reports", () => {
    const r: TopUpReport[] = [
      scan(80, 1),
      { outcome: "covered", item: "scan", amount_ghs: 80, created_at: daysAgo(1) },
      { outcome: "topup", item: "scan", amount_ghs: null, created_at: daysAgo(1) },
      { outcome: "topup", item: null, amount_ghs: 80, created_at: daysAgo(1) },
      { ...scan(80, 1), state: "held" },
    ];
    expect(topUps({ reports: r, responses: [], now })).toEqual([]);
  });

  it("a newer hospital confirm_topup shows 'confirmed by hospital'", () => {
    const confirm: TopUpResponse = { kind: "confirm_topup", item: "scan", amount_ghs: null, created_at: daysAgo(0.5) };
    const [t] = topUps({ reports: [scan(80, 1), scan(80, 2)], responses: [confirm], now });
    expect(t).toMatchObject({ source: "hospital_confirmed", amountGhs: 80 });
    expect(t?.text).toBe("Scan top-up about GH¢ 80 (2 patients, last 60 days), confirmed by hospital");
  });

  it("an older confirm_topup than the newest report does not count", () => {
    const confirm: TopUpResponse = { kind: "confirm_topup", item: "scan", amount_ghs: null, created_at: daysAgo(3) };
    expect(topUps({ reports: [scan(80, 1), scan(80, 2)], responses: [confirm], now })[0]?.source).toBe("patients");
  });

  it("a newer correct_topup replaces the amount", () => {
    const correct: TopUpResponse = { kind: "correct_topup", item: "drugs", amount_ghs: 40, created_at: daysAgo(2) };
    const r: TopUpReport[] = [
      { outcome: "topup", item: "drugs", amount_ghs: 50, created_at: daysAgo(20) },
      { outcome: "topup", item: "drugs", amount_ghs: 60, created_at: daysAgo(10) },
    ];
    const [t] = topUps({ reports: r, responses: [correct], now });
    expect(t).toMatchObject({ item: "drugs", amountGhs: 40, source: "hospital_corrected" });
    expect(t?.text).toBe("Drugs top-up GH¢ 40, corrected by hospital");
  });

  it("the correction stands with 1 newer disagreeing report", () => {
    const correct: TopUpResponse = { kind: "correct_topup", item: "scan", amount_ghs: 40, created_at: daysAgo(5) };
    const [t] = topUps({ reports: [scan(80, 10), scan(80, 9), scan(80, 1)], responses: [correct], now });
    expect(t).toMatchObject({ source: "hospital_corrected", amountGhs: 40 });
  });

  it("2 newer disagreeing reports override the correction (threshold)", () => {
    const correct: TopUpResponse = { kind: "correct_topup", item: "scan", amount_ghs: 40, created_at: daysAgo(5) };
    const [t] = topUps({ reports: [scan(80, 10), scan(80, 9), scan(80, 2), scan(90, 1)], responses: [correct], now });
    expect(t).toMatchObject({ source: "patients", amountGhs: 85 }); // median of the 2 newer reports
  });

  it("newer reports that agree with the correction keep it", () => {
    const correct: TopUpResponse = { kind: "correct_topup", item: "scan", amount_ghs: 40, created_at: daysAgo(5) };
    const [t] = topUps({ reports: [scan(80, 10), scan(80, 9), scan(40, 2), scan(42, 1)], responses: [correct], now });
    expect(t).toMatchObject({ source: "hospital_corrected", amountGhs: 40 });
  });
});
