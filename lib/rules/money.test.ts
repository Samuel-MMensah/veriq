// @vitest-environment node
// Rule 5: money never changes a badge or a ranking. No code path may read a payment or plan field
// in badge or sort logic.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { badge, type BadgeLink, type BadgeReport } from "./badge";
import { sortEmergency, sortResults, type EmergencyItem, type ResultItem } from "./sort";
import { DAY_MS } from "./time";

const now = new Date("2026-10-22T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * DAY_MS).toISOString();
const DANSOMAN = { lat: 5.545, lng: -0.265 };

/** Fields a paid plan might add. None of them may change the result. */
const money = {
  plan: "gold",
  paid: true,
  paying_customer: true,
  sponsored: true,
  premium: true,
  tier: 1,
  priority: 999,
  boost: 100,
  subscription: "active",
  price: 5000,
  payment_status: "paid",
  amount_ghs: 9999,
};

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("rule 5: no payment or plan field in badge or sort logic", () => {
  it.each(["badge.ts", "sort.ts", "freshness.ts", "../geo.ts"])("%s never names a money field", (file) => {
    const code = stripComments(readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8"));
    expect(code).not.toMatch(/plan|pay|paid|price|sponsor|premium|subscri|tier|boost|priority|amount|ghs|fee|billing/i);
  });

  it("extra money fields on the inputs never change a badge", () => {
    const link: BadgeLink = { listed_by: "nhia", hospital_says: null, hospital_confirmed_at: null };
    const reports: BadgeReport[] = [1, 2, 3].map((d) => ({ outcome: "refused", created_at: daysAgo(d) }));
    const plain = badge({ link, reports, now });
    const withMoney = badge({
      link: { ...link, ...money } as BadgeLink,
      reports: reports.map((r) => ({ ...r, ...money })) as BadgeReport[],
      now,
    });
    expect(withMoney).toEqual(plain);
    expect(withMoney.id).toBe("B1"); // a paying hospital still shows its refusals
  });

  it("a paying hospital is not ranked higher in results", () => {
    const north = (km: number) => ({ lat: DANSOMAN.lat + km / 111.195, lng: DANSOMAN.lng });
    const items: ResultItem[] = [
      { id: "free-near", ...north(1), badge: "B2", status: "open", statusUpdatedAt: daysAgo(0.01) },
      { id: "paid-far", ...north(3), badge: "B4", status: "open", statusUpdatedAt: daysAgo(0.01) },
    ];
    const plain = sortResults(items, { origin: DANSOMAN, radiusKm: 5, now }).map((r) => r.id);
    const paid = sortResults(
      items.map((i) => (i.id === "paid-far" ? { ...i, ...money } : i)),
      { origin: DANSOMAN, radiusKm: 5, now },
    ).map((r) => r.id);
    expect(paid).toEqual(plain);
    expect(paid).toEqual(["free-near", "paid-far"]);
  });

  it("a paying hospital is not ranked higher in emergency mode", () => {
    const north = (km: number) => ({ lat: DANSOMAN.lat + km / 111.195, lng: DANSOMAN.lng });
    const items: EmergencyItem[] = [
      { id: "free", ...north(1), status: "accepting", statusUpdatedAt: daysAgo(0.01) },
      { id: "paid", ...north(2), status: "full", statusUpdatedAt: daysAgo(0.01) },
    ];
    const paid = sortEmergency(
      items.map((i) => (i.id === "paid" ? { ...i, ...money } : i)),
      { origin: DANSOMAN, now },
    ).map((r) => r.id);
    expect(paid).toEqual(["free", "paid"]);
  });
});
