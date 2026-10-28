// The admin log (Prompt 10): every admin action, with who, what, when and why, in the append-only
// admin_actions table. Shown as a history on each hospital and each staff account.
import { actorLabel, type Staff } from "@/lib/auth/staff";
import type { Db } from "@/lib/db/supabase";
import type { AdminActionKind, AdminActionRow, FacilityRow } from "@/lib/db/types";

export type AdminResult<T = object> = ({ ok: true } & T) | { ok: false; message: string };

export const fail = (message: string): { ok: false; message: string } => ({ ok: false, message });

export async function logAction(
  db: Db,
  actor: Staff,
  now: Date,
  entry: {
    action: AdminActionKind;
    facility_id?: string | null;
    profile_id?: string | null;
    report_id?: string | null;
    reason?: string | null;
    details?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await db.from("admin_actions").insert({
    actor_id: actor.userId,
    actor_label: actorLabel(actor),
    action: entry.action,
    facility_id: entry.facility_id ?? null,
    profile_id: entry.profile_id ?? null,
    report_id: entry.report_id ?? null,
    reason: entry.reason?.trim() || null,
    details: entry.details ?? {},
    created_at: now.toISOString(),
  });
  if (error) throw new Error(`Could not write the admin log: ${error.message}`);
}

/** Newest first. */
export async function historyFor(db: Db, by: { facility_id: string } | { profile_id: string }): Promise<AdminActionRow[]> {
  const [column, value] = Object.entries(by)[0] as [string, string];
  const { data, error } = await db.from("admin_actions").select("*").eq(column, value).order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load the history: ${error.message}`);
  return (data ?? []) as AdminActionRow[];
}

export async function recentActions(db: Db, since: string): Promise<AdminActionRow[]> {
  const { data, error } = await db.from("admin_actions").select("*").gte("created_at", since).order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load the admin log: ${error.message}`);
  return (data ?? []) as AdminActionRow[];
}

const WHAT: Record<AdminActionKind, string> = {
  create_account: "Made the account",
  disable_account: "Switched the account off",
  enable_account: "Switched the account back on",
  reset_password: "Reset the password",
  link_account: "Changed what the account is linked to",
  verify_hospital: "Verified the hospital",
  unverify_hospital: "Removed verification",
  release_report: "Released a held report",
  reject_report: "Rejected a held report",
  set_location: "Set the map location",
  record_call: "Recorded a verification call",
};

/** "Verified the hospital", in plain words. */
export function actionText(kind: AdminActionKind): string {
  return WHAT[kind];
}

export async function loadFacility(db: Db, id: string): Promise<FacilityRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db.from("facilities").select("*").eq("id", id).maybeSingle();
  return (data as FacilityRow | null) ?? null;
}
