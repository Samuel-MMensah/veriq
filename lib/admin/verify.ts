// Verifying a hospital (Prompt 10). A hospital account is a claim: "I work at this facility". An admin
// checks it before the hospital's staff can publish anything (a morning check or hospital answers):
//   1. the name matches the NHIA list entry, and
//   2. the admin called the hospital back on a number they found themselves, not one the claimant gave.
// Then the facility is marked verified, with who and when, and the admin log keeps the details.
import { adminMayAct, type Staff } from "@/lib/auth/staff";
import type { Db } from "@/lib/db/supabase";
import type { FacilityRow, ProfileRow } from "@/lib/db/types";
import { fail, loadFacility, logAction, type AdminResult } from "./log";

export type VerifyChecks = {
  nameMatches: boolean;
  calledBack: boolean;
  /** The number the admin called and where they found it, e.g. "030 266 1234, GHS directory". */
  knownNumber: string;
  note: string;
};

export async function verifyHospital({
  db,
  actor,
  facilityId,
  checks,
  now,
}: {
  db: Db;
  actor: Staff;
  facilityId: string;
  checks: VerifyChecks;
  now: Date;
}): Promise<AdminResult> {
  const facility = await loadFacility(db, facilityId);
  if (!facility) return fail("That hospital doesn't exist.");
  if (!adminMayAct(actor, facility)) return fail("Only a signed-in Veriq admin can verify a real hospital.");
  if (facility.verified) return fail("This hospital is already verified.");
  if (!checks.nameMatches) return fail("Check the name against the NHIA list first.");
  if (!checks.calledBack) return fail("Call the hospital back on a number you found yourself first.");
  if (checks.knownNumber.trim().length < 6) return fail("Write the number you called and where you found it.");

  const { error } = await db
    .from("facilities")
    .update({ verified: true, verified_at: now.toISOString(), verified_by: actor.userId })
    .eq("id", facility.id);
  if (error) return fail(`Could not save: ${error.message}`);
  await logAction(db, actor, now, {
    action: "verify_hospital",
    facility_id: facility.id,
    reason: checks.note || "Name matches the NHIA list; called back on a known number",
    details: { name_matches_nhia: true, called_back: true, known_number: checks.knownNumber.trim(), nhia_ref: facility.source_ref },
  });
  return { ok: true };
}

/** Take verification away (e.g. the claim was wrong). Staff can no longer publish. A reason is required. */
export async function unverifyHospital({
  db,
  actor,
  facilityId,
  reason,
  now,
}: {
  db: Db;
  actor: Staff;
  facilityId: string;
  reason: string;
  now: Date;
}): Promise<AdminResult> {
  const facility = await loadFacility(db, facilityId);
  if (!facility) return fail("That hospital doesn't exist.");
  if (!adminMayAct(actor, facility)) return fail("Only a signed-in Veriq admin can change a real hospital.");
  if (!facility.verified) return fail("This hospital isn't verified.");
  if (reason.trim().length < 3) return fail("Say why, for the admin log.");
  const { error } = await db.from("facilities").update({ verified: false, verified_at: null, verified_by: null }).eq("id", facility.id);
  if (error) return fail(`Could not save: ${error.message}`);
  await logAction(db, actor, now, { action: "unverify_hospital", facility_id: facility.id, reason });
  return { ok: true };
}

export type HospitalClaim = { facility: FacilityRow; staff: ProfileRow[] };

/**
 * Hospitals with at least one staff account: the claims. Waiting ones first (oldest claim first),
 * then verified ones. `source` follows demo mode (rule D2).
 */
export async function listHospitalClaims(db: Db, source: FacilityRow["source"]): Promise<{ waiting: HospitalClaim[]; verified: HospitalClaim[] }> {
  const { data: profiles } = await db.from("profiles").select("*").eq("role", "hospital").order("created_at");
  const byFacility = new Map<string, ProfileRow[]>();
  for (const p of (profiles ?? []) as ProfileRow[]) {
    if (p.facility_id) byFacility.set(p.facility_id, [...(byFacility.get(p.facility_id) ?? []), p]);
  }
  const { data } = await db.from("facilities").select("*").in("id", [...byFacility.keys()]);
  const claims = ((data ?? []) as FacilityRow[])
    .filter((f) => f.source === source)
    .map((facility) => ({ facility, staff: byFacility.get(facility.id) ?? [] }))
    .sort((a, b) => a.staff[0]!.created_at.localeCompare(b.staff[0]!.created_at));
  return { waiting: claims.filter((c) => !c.facility.verified), verified: claims.filter((c) => c.facility.verified) };
}
