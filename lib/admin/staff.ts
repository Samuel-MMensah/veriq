// Staff accounts (Prompt 10, /admin/staff): an admin makes, links, switches off and resets accounts.
// No email or SMS is sent: the admin reads the one-time password to the person, or writes it down,
// and the person sets their own on first sign-in.
import type { AuthBackend } from "@/lib/auth/backend";
import { normaliseEmail, oneTimePassword } from "@/lib/auth/password";
import { adminMayAct, type Staff } from "@/lib/auth/staff";
import type { Db } from "@/lib/db/supabase";
import type { FacilityRow, InsurerRow, ProfileRow, StaffRole } from "@/lib/db/types";
import { displayName, displayPlace } from "@/lib/view/names";
import { fail, loadFacility, logAction, type AdminResult } from "./log";

const ROLES: StaffRole[] = ["hospital", "insurer", "admin"];
const NO_RIGHT = "Only a signed-in Veriq admin can change staff accounts. The demo login can't.";

export type NewAccount = { email: string; name: string; role: string; facilityId?: string; insurerId?: string };

/** The facility or insurer a role needs, checked: hospitals link to a real facility only (rule D2). */
async function linkTarget(db: Db, role: StaffRole, facilityId?: string, insurerId?: string) {
  if (role === "hospital") {
    const f = facilityId ? await loadFacility(db, facilityId) : null;
    if (!f) return fail("Choose the hospital this person works at.");
    if (f.source !== "nhia") return fail("Staff accounts link to real facilities only, not demo ones.");
    return { ok: true as const, facility_id: f.id, insurer_id: null };
  }
  if (role === "insurer") {
    const { data } = insurerId ? await db.from("insurers").select("*").eq("id", insurerId).maybeSingle() : { data: null };
    if (!data) return fail("Choose the insurer this person works for.");
    return { ok: true as const, facility_id: null, insurer_id: (data as InsurerRow).id };
  }
  return { ok: true as const, facility_id: null, insurer_id: null };
}

export async function createStaffAccount({
  db,
  auth,
  actor,
  input,
  now,
}: {
  db: Db;
  auth: AuthBackend;
  actor: Staff;
  input: NewAccount;
  now: Date;
}): Promise<AdminResult<{ userId: string; email: string; oneTimePassword: string }>> {
  if (!adminMayAct(actor, "accounts")) return fail(NO_RIGHT);
  const email = normaliseEmail(input.email);
  if (!email) return fail("Type a work email address, e.g. name@hospital.org.");
  const name = input.name.trim();
  if (name.length < 2) return fail("Type the person's name, so other admins know who this is.");
  const role = input.role as StaffRole;
  if (!ROLES.includes(role)) return fail("Choose what the person does: hospital, insurer or admin.");
  const link = await linkTarget(db, role, input.facilityId, input.insurerId);
  if (!link.ok) return link;

  const password = oneTimePassword();
  const created = await auth.createUser(email, password);
  if (!created.ok) return created;
  const { error } = await db.from("profiles").insert({
    user_id: created.userId,
    role,
    facility_id: link.facility_id,
    insurer_id: link.insurer_id,
    email,
    display_name: name,
    must_change_password: true,
    sessions_valid_after: now.toISOString(),
    created_by: actor.userId,
    created_at: now.toISOString(),
  });
  if (error) return fail(`The login was made but the profile failed: ${error.message}`);
  await logAction(db, actor, now, {
    action: "create_account",
    profile_id: created.userId,
    facility_id: link.facility_id,
    details: { role, email, name, insurer_id: link.insurer_id },
  });
  return { ok: true, userId: created.userId, email, oneTimePassword: password };
}

async function loadProfile(db: Db, userId: string): Promise<ProfileRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return null;
  const { data } = await db.from("profiles").select("*").eq("user_id", userId).maybeSingle();
  return (data as ProfileRow | null) ?? null;
}

/** Switch an account off (it can't sign in, and its sessions end) or back on. */
export async function setAccountDisabled({
  db,
  auth,
  actor,
  userId,
  disabled,
  reason,
  now,
}: {
  db: Db;
  auth: AuthBackend;
  actor: Staff;
  userId: string;
  disabled: boolean;
  reason: string;
  now: Date;
}): Promise<AdminResult> {
  if (!adminMayAct(actor, "accounts")) return fail(NO_RIGHT);
  const profile = await loadProfile(db, userId);
  if (!profile) return fail("That account doesn't exist.");
  if (disabled && profile.user_id === actor.userId) return fail("You can't switch off your own account.");
  if (disabled && reason.trim().length < 3) return fail("Say why, for the admin log.");
  if (Boolean(profile.disabled_at) === disabled) return fail(disabled ? "That account is already off." : "That account is already on.");
  await auth.setBanned(userId, disabled);
  const { error } = await db
    .from("profiles")
    .update({ disabled_at: disabled ? now.toISOString() : null, sessions_valid_after: now.toISOString() })
    .eq("user_id", userId);
  if (error) return fail(`Could not save: ${error.message}`);
  await logAction(db, actor, now, {
    action: disabled ? "disable_account" : "enable_account",
    profile_id: userId,
    facility_id: profile.facility_id,
    reason,
  });
  return { ok: true };
}

/** A new one-time password, to hand over by hand. The old password and every session stop working. */
export async function resetStaffPassword({
  db,
  auth,
  actor,
  userId,
  reason,
  now,
}: {
  db: Db;
  auth: AuthBackend;
  actor: Staff;
  userId: string;
  reason: string;
  now: Date;
}): Promise<AdminResult<{ email: string; oneTimePassword: string }>> {
  if (!adminMayAct(actor, "accounts")) return fail(NO_RIGHT);
  const profile = await loadProfile(db, userId);
  if (!profile) return fail("That account doesn't exist.");
  const password = oneTimePassword();
  await auth.setPassword(userId, password);
  const { error } = await db
    .from("profiles")
    .update({ must_change_password: true, sessions_valid_after: now.toISOString() })
    .eq("user_id", userId);
  if (error) return fail(`Could not save: ${error.message}`);
  await logAction(db, actor, now, { action: "reset_password", profile_id: userId, facility_id: profile.facility_id, reason });
  return { ok: true, email: profile.email ?? "", oneTimePassword: password };
}

/** Link a hospital account to its facility, or an insurer account to its insurer. */
export async function linkAccount({
  db,
  actor,
  userId,
  facilityId,
  insurerId,
  now,
}: {
  db: Db;
  actor: Staff;
  userId: string;
  facilityId?: string;
  insurerId?: string;
  now: Date;
}): Promise<AdminResult> {
  if (!adminMayAct(actor, "accounts")) return fail(NO_RIGHT);
  const profile = await loadProfile(db, userId);
  if (!profile) return fail("That account doesn't exist.");
  if (profile.role === "admin") return fail("Admin accounts aren't linked to a hospital or insurer.");
  const link = await linkTarget(db, profile.role, facilityId, insurerId);
  if (!link.ok) return link;
  if (link.facility_id === profile.facility_id && link.insurer_id === profile.insurer_id) return fail("It is already linked there.");
  const { error } = await db.from("profiles").update({ facility_id: link.facility_id, insurer_id: link.insurer_id }).eq("user_id", userId);
  if (error) return fail(`Could not save: ${error.message}`);
  await logAction(db, actor, now, {
    action: "link_account",
    profile_id: userId,
    facility_id: link.facility_id ?? profile.facility_id,
    details: {
      from: profile.facility_id ?? profile.insurer_id,
      to: link.facility_id ?? link.insurer_id,
    },
  });
  return { ok: true };
}

export type StaffListItem = ProfileRow & { linkedTo: string | null };

/** Every staff account, newest first, with the name of what it is linked to. */
export async function listStaff(db: Db): Promise<StaffListItem[]> {
  const [{ data: profiles }, { data: insurers }] = await Promise.all([
    db.from("profiles").select("*").order("created_at", { ascending: false }),
    db.from("insurers").select("*"),
  ]);
  const list = (profiles ?? []) as ProfileRow[];
  const facilityIds = [...new Set(list.map((p) => p.facility_id).filter((x): x is string => !!x))];
  const { data: facilities } = await db.from("facilities").select("*").in("id", facilityIds);
  const names = new Map<string, string>([
    ...((facilities ?? []) as FacilityRow[]).map((f) => [f.id, f.name] as [string, string]),
    ...((insurers ?? []) as InsurerRow[]).map((i) => [i.id, i.name] as [string, string]),
  ]);
  return list.map((p) => ({ ...p, linkedTo: names.get(p.facility_id ?? p.insurer_id ?? "") ?? null }));
}


/** Real facilities to link a hospital account to, grouped by district (rule D2: never demo ones). */
export async function facilityOptions(db: Db): Promise<{ id: string; label: string; group: string }[]> {
  const { data } = await db.from("facilities").select("*").eq("source", "nhia").order("name");
  return ((data ?? []) as FacilityRow[])
    .map((f) => ({ id: f.id, label: displayName(f.name), group: displayPlace(f.district) ?? f.district }))
    .sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));
}
