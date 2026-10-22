// Report reads and writes for /api/reports. Server only: these use the service role, because
// card_reports has no public read or insert policy (rule A).
import type { Db } from "./supabase";
import type { CardReportRow, ReportItem, ReportOutcome, ReportState } from "./types";

type Result<T> = { data: T | null; error: { message: string } | null };

function rows<T>({ data, error }: Result<T[]>, what: string): T[] {
  if (error) throw new Error(`Could not load ${what}: ${error.message}`);
  return data ?? [];
}

/** This device's reports since `since`, any facility and any state (rule A). */
export async function deviceReportsSince(db: Db, hash: string, since: string) {
  return rows(
    await db.from("card_reports").select("*").eq("device_hash", hash).gte("created_at", since),
    "this phone's reports",
  ) as Pick<CardReportRow, "facility_id" | "created_at">[];
}

/** Every report for a facility since `since`, any device and any state (rule A burst check). */
export async function facilityReportsSince(db: Db, facilityId: string, since: string) {
  return rows(
    await db.from("card_reports").select("*").eq("facility_id", facilityId).gte("created_at", since),
    "the hospital's reports",
  ) as Pick<CardReportRow, "created_at">[];
}

export async function facilityAndInsurerExist(db: Db, facilityId: string, insurerId: string): Promise<boolean> {
  const [f, i] = await Promise.all([
    db.from("facilities").select("*").eq("id", facilityId).maybeSingle(),
    db.from("insurers").select("*").eq("id", insurerId).maybeSingle(),
  ]);
  if (f.error || i.error) throw new Error(`Could not check the report: ${(f.error ?? i.error)!.message}`);
  return Boolean(f.data && i.data);
}

export async function serviceExists(db: Db, serviceId: string): Promise<boolean> {
  const s = await db.from("services").select("*").eq("id", serviceId).maybeSingle();
  if (s.error) throw new Error(`Could not check the service: ${s.error.message}`);
  return Boolean(s.data);
}

export type NewReport = {
  facility_id: string;
  insurer_id: string;
  service_id: string | null;
  outcome: ReportOutcome;
  amount_ghs: number | null;
  item: ReportItem | null;
  device_hash: string;
  state: ReportState;
};

export async function insertReport(db: Db, report: NewReport): Promise<string> {
  const { data, error } = await db.from("card_reports").insert(report).select("*").single();
  if (error || !data) throw new Error(`Could not save the report: ${error?.message ?? "no row"}`);
  return (data as CardReportRow).id;
}
