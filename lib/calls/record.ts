// Prompt 10b: saves verification calls and reads them back for /admin/calls. Real facilities and
// real admin accounts only (the demo admin can look, not save). Each call is saved all or nothing
// by record_verification_call() in the database, which also writes the admin log.
import { adminMayAct, actorLabel, type Staff } from "@/lib/auth/staff";
import type { Db } from "@/lib/db/supabase";
import type { FacilityInsurerRow, FacilityRow, InsurerRow, ProfileRow, VerificationCallAnswerRow, VerificationCallRow } from "@/lib/db/types";
import { fail, loadFacility, type AdminResult } from "@/lib/admin/log";
import type { CallPayload } from "./input";
import { summarizeCalls, type CallSummary } from "./summary";

const DUPLICATE = /verification_calls_facility_id_called_at_key|duplicate key/i;

export async function recordCall({
  db,
  actor,
  payload,
  enteredVia = "form",
}: {
  db: Db;
  actor: Staff;
  payload: CallPayload;
  enteredVia?: "form" | "csv";
}): Promise<AdminResult<{ callId: string; facility: FacilityRow }>> {
  const facility = await loadFacility(db, payload.facility_id);
  if (!facility || facility.source === "demo") return fail("Calls are for real facilities only.");
  if (!adminMayAct(actor, facility)) return fail("Only a signed-in Veriq admin can record a call.");
  const { data, error } = await db.rpc("record_verification_call", {
    p: { ...payload, entered_via: enteredVia, actor_id: actor.userId, actor_label: actorLabel(actor) },
  });
  if (error) return fail(DUPLICATE.test(error.message) ? "This call is already recorded: same facility and time." : `Could not save: ${error.message}`);
  return { ok: true, callId: data as string, facility };
}

/** Active admin accounts, who can be named as the caller: user id to email. */
export async function callerAccounts(db: Db): Promise<Map<string, string>> {
  const { data, error } = await db.from("profiles").select("*").eq("role", "admin");
  if (error) throw new Error(`Could not load admin accounts: ${error.message}`);
  return new Map(
    ((data ?? []) as ProfileRow[]).filter((p) => !p.disabled_at && p.email).map((p) => [p.user_id, p.email!.toLowerCase()]),
  );
}

export type CallListItem = VerificationCallRow & { facility: Pick<FacilityRow, "id" | "name" | "district" | "source_ref"> | null; answers: VerificationCallAnswerRow[] };

/** Every call, newest first, with its answers and facility. */
export async function listCalls(db: Db): Promise<CallListItem[]> {
  const [calls, answers] = await Promise.all([
    db.from("verification_calls").select("*").order("called_at", { ascending: false }),
    db.from("verification_call_answers").select("*"),
  ]);
  if (calls.error || answers.error) throw new Error(`Could not load calls: ${(calls.error ?? answers.error)!.message}`);
  const rows = (calls.data ?? []) as VerificationCallRow[];
  const ids = [...new Set(rows.map((c) => c.facility_id))];
  const facilities = ids.length ? (((await db.from("facilities").select("*").in("id", ids)).data ?? []) as FacilityRow[]) : [];
  const byId = new Map(facilities.map((f) => [f.id, f]));
  const answersBy = new Map<string, VerificationCallAnswerRow[]>();
  for (const a of (answers.data ?? []) as VerificationCallAnswerRow[]) answersBy.set(a.call_id, [...(answersBy.get(a.call_id) ?? []), a]);
  return rows.map((c) => ({ ...c, facility: byId.get(c.facility_id) ?? null, answers: answersBy.get(c.id) ?? [] }));
}

/** /admin/calls/summary: every call so far, per card, against today's official lists. */
export async function loadCallSummary(db: Db, insurers: InsurerRow[]): Promise<CallSummary> {
  const calls = await listCalls(db);
  const ids = [...new Set(calls.map((c) => c.facility_id))];
  const links = ids.length ? (((await db.from("facility_insurers").select("*").in("facility_id", ids)).data ?? []) as FacilityInsurerRow[]) : [];
  return summarizeCalls({ calls, answers: calls.flatMap((c) => c.answers), links, insurers });
}
