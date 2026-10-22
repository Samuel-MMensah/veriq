// Rule T: top-ups patients paid on top of their card, per facility, insurer and item.
// Callers pass reports and replies for one facility and one insurer.
import type { HospitalResponseKind, ReportItem, ReportOutcome, ReportState } from "@/lib/db/types";
import { withinDays } from "./time";

export type TopUpReport = {
  outcome: ReportOutcome;
  item: ReportItem | null;
  amount_ghs: number | null;
  created_at: string;
  /** Absent means live. */
  state?: ReportState;
};

export type TopUpResponse = {
  kind: HospitalResponseKind;
  item: ReportItem | null;
  amount_ghs: number | null;
  created_at: string;
};

export type TopUpSource = "patients" | "hospital_confirmed" | "hospital_corrected";

export type TopUp = {
  item: ReportItem;
  amountGhs: number;
  source: TopUpSource;
  /** Patient reports behind the amount. */
  reportCount: number;
  text: string;
};

const WINDOW_DAYS = 60;
const MIN_REPORTS = 2;
const ITEMS: ReportItem[] = ["scan", "drugs", "lab", "registration"];
const ITEM_LABEL: Record<ReportItem, string> = { scan: "Scan", drugs: "Drugs", lab: "Lab", registration: "Registration" };

export function median(values: number[]): number {
  if (values.length === 0) throw new Error("median of nothing");
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Amounts are shown rounded to the nearest GH¢ 5 (rule T). Halves round up. */
export function roundToNearest5(amount: number): number {
  return Math.round(amount / 5) * 5;
}

const time = (iso: string) => new Date(iso).getTime();

type Paid = { amount: number; at: number };

export function topUps({
  reports,
  responses,
  now,
}: {
  reports: TopUpReport[];
  responses: TopUpResponse[];
  now: Date;
}): TopUp[] {
  const result: TopUp[] = [];

  for (const item of ITEMS) {
    // rule T: live top-up reports with an amount, for this item, in the last 60 days. Rule A: held never counts.
    const paid: Paid[] = reports
      .filter(
        (r) =>
          (r.state ?? "live") === "live" &&
          r.outcome === "topup" &&
          r.item === item &&
          r.amount_ghs !== null &&
          withinDays(r.created_at, now, WINDOW_DAYS),
      )
      .map((r) => ({ amount: r.amount_ghs!, at: time(r.created_at) }));
    // rule T: at least 2 reports.
    if (paid.length < MIN_REPORTS) continue;

    const newestReport = Math.max(...paid.map((p) => p.at));
    const latestReply = responses
      .filter(
        (r) =>
          r.item === item &&
          (r.kind === "confirm_topup" || (r.kind === "correct_topup" && r.amount_ghs !== null)) &&
          withinDays(r.created_at, now, WINDOW_DAYS),
      )
      .sort((a, b) => time(b.created_at) - time(a.created_at))[0];

    // rule T: a newer correct_topup replaces the amount until at least 2 newer patient reports disagree.
    if (latestReply?.kind === "correct_topup") {
      const corrected = latestReply.amount_ghs!;
      const after = paid.filter((p) => p.at > time(latestReply.created_at));
      const disagree = after.filter((p) => roundToNearest5(p.amount) !== roundToNearest5(corrected));
      if (disagree.length < MIN_REPORTS) {
        result.push(make(item, corrected, "hospital_corrected", paid.length));
      } else {
        result.push(make(item, roundToNearest5(median(after.map((p) => p.amount))), "patients", after.length));
      }
      continue;
    }

    const amount = roundToNearest5(median(paid.map((p) => p.amount)));
    // rule T: a hospital confirm_topup newer than the patient reports shows "confirmed by hospital".
    const confirmed = latestReply?.kind === "confirm_topup" && time(latestReply.created_at) > newestReport;
    result.push(make(item, amount, confirmed ? "hospital_confirmed" : "patients", paid.length));
  }

  return result;
}

function make(item: ReportItem, amountGhs: number, source: TopUpSource, reportCount: number): TopUp {
  const label = ITEM_LABEL[item];
  const text =
    source === "hospital_corrected"
      ? `${label} top-up GH¢ ${amountGhs}, corrected by hospital`
      : `${label} top-up about GH¢ ${amountGhs} (${reportCount} ${reportCount === 1 ? "patient" : "patients"}, last ${WINDOW_DAYS} days)${
          source === "hospital_confirmed" ? ", confirmed by hospital" : ""
        }`;
  return { item, amountGhs, source, reportCount, text };
}
