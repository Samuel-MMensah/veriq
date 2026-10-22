// Report history over the last 7 days, 30 days and 12 months (team decision 2026-10-22):
// history is kept and every count says which period it covers.
import type { ReportOutcome, ReportState } from "@/lib/db/types";
import { withinDays } from "./time";

export type Period = "week" | "month" | "year";
export type PeriodCounts = { accepted: number; refused: number };
export type ReportHistory = Record<Period, PeriodCounts>;

export const PERIOD_DAYS: Record<Period, number> = { week: 7, month: 30, year: 365 };
export const PERIOD_LABEL: Record<Period, string> = {
  week: "last 7 days",
  month: "last 30 days",
  year: "last 12 months",
};

export function reportHistory(
  reports: { outcome: ReportOutcome; created_at: string; state?: ReportState }[],
  now: Date,
): ReportHistory {
  // Rule A: held and rejected reports are kept in the database but never count.
  const live = reports.filter((r) => (r.state ?? "live") === "live");
  const count = (days: number): PeriodCounts => {
    const inPeriod = live.filter((r) => withinDays(r.created_at, now, days));
    return {
      accepted: inPeriod.filter((r) => r.outcome !== "refused").length,
      refused: inPeriod.filter((r) => r.outcome === "refused").length,
    };
  };
  return { week: count(PERIOD_DAYS.week), month: count(PERIOD_DAYS.month), year: count(PERIOD_DAYS.year) };
}
