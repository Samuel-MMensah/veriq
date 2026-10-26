// Held reports (rule A, Prompt 10). More than 10 reports for one facility in an hour are held. An
// admin releases each (it is live and counts from then on) or rejects it (it never counts), after a
// confirmation and with a reason. Device hashes never leave the server or reach the screen (rule 2).
import { adminMayAct, type Staff } from "@/lib/auth/staff";
import type { Db } from "@/lib/db/supabase";
import type { CardReportRow, FacilityRow, FacilitySource } from "@/lib/db/types";
import { fail, loadFacility, logAction, type AdminResult } from "./log";

export type HeldReport = Omit<CardReportRow, "device_hash"> & { facilityName: string; source: FacilitySource };

/** Held reports, oldest first, for the facilities shown in this mode (rule D2). */
export async function listHeldReports(db: Db, source: FacilitySource): Promise<HeldReport[]> {
  const { data } = await db.from("card_reports").select("*").eq("state", "held").order("created_at");
  const reports = (data ?? []) as CardReportRow[];
  const { data: fs } = await db.from("facilities").select("*").in("id", [...new Set(reports.map((r) => r.facility_id))]);
  const facilities = new Map(((fs ?? []) as FacilityRow[]).map((f) => [f.id, f]));
  return reports.flatMap((row) => {
    const f = facilities.get(row.facility_id);
    if (!f || f.source !== source) return [];
    const r: Partial<CardReportRow> = { ...row };
    delete r.device_hash;
    return [{ ...(r as Omit<CardReportRow, "device_hash">), facilityName: f.name, source: f.source }];
  });
}

export async function reviewHeldReport({
  db,
  actor,
  reportId,
  decision,
  reason,
  now,
}: {
  db: Db;
  actor: Staff;
  reportId: string;
  decision: "release" | "reject";
  reason: string;
  now: Date;
}): Promise<AdminResult> {
  if (!/^[0-9a-f-]{36}$/i.test(reportId)) return fail("That report doesn't exist.");
  const { data } = await db.from("card_reports").select("*").eq("id", reportId).maybeSingle();
  const report = data as CardReportRow | null;
  if (!report) return fail("That report doesn't exist.");
  const facility = await loadFacility(db, report.facility_id);
  if (!facility || !adminMayAct(actor, facility)) return fail("Only a signed-in Veriq admin can review reports on a real hospital.");
  // rule A: only a held report is reviewed; a rejected one never comes back.
  if (report.state !== "held") return fail(report.state === "live" ? "That report was already released." : "That report was already rejected.");
  if (reason.trim().length < 3) return fail("Say why, for the admin log.");

  const { error } = await db
    .from("card_reports")
    .update({ state: decision === "release" ? "live" : "rejected", reviewed_at: now.toISOString(), reviewed_by: actor.userId })
    .eq("id", report.id)
    .eq("state", "held");
  if (error) return fail(`Could not save: ${error.message}`);
  await logAction(db, actor, now, {
    action: decision === "release" ? "release_report" : "reject_report",
    facility_id: report.facility_id,
    report_id: report.id,
    reason,
    details: { outcome: report.outcome, insurer_id: report.insurer_id, reported_at: report.created_at },
  });
  return { ok: true };
}
