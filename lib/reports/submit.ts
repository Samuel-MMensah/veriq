// Screen 4 → /api/reports: checks a patient report and saves it under rule A.
// Rule 2: the body may hold only these fields. The random device id is hashed with the server
// secret and then dropped; only the hash is stored. Nothing here logs the body.
import type { Db } from "@/lib/db/supabase";
import {
  deviceReportsSince,
  facilityAndInsurerExist,
  facilityReportsSince,
  insertReport,
  serviceExists,
} from "@/lib/db/reports";
import type { ReportItem, ReportOutcome } from "@/lib/db/types";
import { checkReport, deviceHash } from "@/lib/rules/limits";
import { DAY_MS, HOUR_MS } from "@/lib/rules/time";

export type ReportInput = {
  deviceId: string;
  facilityId: string;
  insurerId: string;
  outcome: ReportOutcome;
  amountGhs: number | null;
  item: ReportItem | null;
  serviceId: string | null;
};

export type SubmitResult =
  | { status: "counted" | "held"; reportId: string }
  | { status: "already_counted"; message: string }
  | { status: "invalid"; message: string };

const ALLOWED = new Set(["deviceId", "facilityId", "insurerId", "outcome", "amountGhs", "item", "serviceId"]);
const OUTCOMES: ReportOutcome[] = ["covered", "topup", "refused"];
const ITEMS: ReportItem[] = ["scan", "drugs", "lab", "registration"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEVICE_ID = /^[A-Za-z0-9_-]{8,128}$/;
export const MAX_AMOUNT_GHS = 100_000;

type Validation = { ok: true; value: ReportInput } | { ok: false; message: string };

export function validateReport(body: unknown): Validation {
  const bad = (message: string): Validation => ({ ok: false, message });
  if (!body || typeof body !== "object" || Array.isArray(body)) return bad("The report is empty.");
  const b = body as Record<string, unknown>;
  // Rule 2: refuse anything that isn't a known field, such as a name or card number.
  if (Object.keys(b).some((k) => !ALLOWED.has(k))) return bad("The report has fields we don't accept.");

  if (typeof b.deviceId !== "string" || !DEVICE_ID.test(b.deviceId)) return bad("The phone id is missing.");
  if (typeof b.facilityId !== "string" || !UUID.test(b.facilityId)) return bad("Unknown hospital.");
  if (typeof b.insurerId !== "string" || !UUID.test(b.insurerId)) return bad("Unknown card.");
  if (!OUTCOMES.includes(b.outcome as ReportOutcome)) return bad("Please choose what happened.");
  const outcome = b.outcome as ReportOutcome;

  const amount = b.amountGhs ?? null;
  const item = b.item ?? null;
  if (outcome !== "topup" && (amount !== null || item !== null)) return bad("Only a top-up has an amount or item.");
  if (amount !== null && (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT_GHS)) {
    return bad(`The amount must be between GH¢ 0 and GH¢ ${MAX_AMOUNT_GHS.toLocaleString("en-GB")}.`);
  }
  if (item !== null && !ITEMS.includes(item as ReportItem)) return bad("Please choose what the top-up was for.");

  const serviceId = b.serviceId ?? null;
  if (serviceId !== null && (typeof serviceId !== "string" || !/^[a-z_]+$/.test(serviceId))) return bad("Unknown service.");

  return {
    ok: true,
    value: {
      deviceId: b.deviceId,
      facilityId: b.facilityId,
      insurerId: b.insurerId,
      outcome,
      amountGhs: amount === null ? null : Math.round((amount as number) * 100) / 100,
      item: item as ReportItem | null,
      serviceId: serviceId as string | null,
    },
  };
}

export async function submitReport({
  db,
  body,
  secret,
  now,
}: {
  /** Service-role access: card_reports has no public policies. */
  db: Db;
  body: unknown;
  secret: string;
  now: Date;
}): Promise<SubmitResult> {
  if (!secret) throw new Error("REPORT_HASH_SECRET is not set.");
  const checked = validateReport(body);
  if (!checked.ok) return { status: "invalid", message: checked.message };
  const r = checked.value;

  if (!(await facilityAndInsurerExist(db, r.facilityId, r.insurerId))) {
    return { status: "invalid", message: "Unknown hospital or card." };
  }
  if (r.serviceId && !(await serviceExists(db, r.serviceId))) return { status: "invalid", message: "Unknown service." };

  // rule A: the stored id is SHA-256 of the device id plus the server secret.
  const hash = deviceHash(r.deviceId, secret);
  const [deviceReports, facilityReports] = await Promise.all([
    deviceReportsSince(db, hash, new Date(now.getTime() - 7 * DAY_MS).toISOString()),
    facilityReportsSince(db, r.facilityId, new Date(now.getTime() - HOUR_MS).toISOString()),
  ]);

  // rule A: one report per device per facility per 7 days; more than 10 in an hour are held.
  const check = checkReport({ facilityId: r.facilityId, deviceReports, facilityReports, now });
  if (!check.ok) return { status: "already_counted", message: check.message };

  const reportId = await insertReport(db, {
    facility_id: r.facilityId,
    insurer_id: r.insurerId,
    service_id: r.serviceId,
    outcome: r.outcome,
    amount_ghs: r.amountGhs,
    item: r.item,
    device_hash: hash,
    state: check.state,
  });
  return { status: check.state === "live" ? "counted" : "held", reportId };
}
