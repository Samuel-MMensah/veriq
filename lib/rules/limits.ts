// Rule A: report limits. Server only (uses node:crypto); /api/reports applies these before inserting.
import { createHash } from "node:crypto";
import type { ReportState } from "@/lib/db/types";
import { DAY_MS, HOUR_MS, ageMs } from "./time";

const REPEAT_DAYS = 7;
const BURST_LIMIT = 10;

export const ALREADY_COUNTED_MESSAGE =
  "Thank you. Your report for this hospital is already counted. You can report again after a week.";

/** rule A: SHA-256 of the random device id plus a server-side secret. Only this hash is stored (rule 2). */
export function deviceHash(deviceId: string, secret: string): string {
  if (!secret) throw new Error("A server secret is required to hash device ids.");
  return createHash("sha256").update(`${deviceId}:${secret}`).digest("hex");
}

export type ReportCheck =
  | { ok: true; state: Extract<ReportState, "live" | "held"> }
  | { ok: false; reason: "already_counted"; message: string };

export function checkReport({
  facilityId,
  deviceReports,
  facilityReports,
  now,
}: {
  facilityId: string;
  /** Earlier reports from this device hash (any facility, any state). */
  deviceReports: { facility_id: string; created_at: string }[];
  /** Earlier reports for this facility (any device, any state). */
  facilityReports: { created_at: string }[];
  now: Date;
}): ReportCheck {
  // rule A: one report per device per facility per 7 days. Exactly 7 days later is allowed.
  const repeat = deviceReports.some(
    (r) => r.facility_id === facilityId && ageMs(r.created_at, now) < REPEAT_DAYS * DAY_MS,
  );
  if (repeat) return { ok: false, reason: "already_counted", message: ALREADY_COUNTED_MESSAGE };

  // rule A: more than 10 reports for one facility in an hour puts new ones in "held".
  const lastHour = facilityReports.filter((r) => ageMs(r.created_at, now) < HOUR_MS).length;
  return { ok: true, state: lastHour >= BURST_LIMIT ? "held" : "live" };
}

/** rule A: held and rejected reports never count. */
export function countsTowardRules(state: ReportState): boolean {
  return state === "live";
}
