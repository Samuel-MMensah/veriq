// Who is signed in, and what they may do (Prompt 10). Pure functions: the session code (session.ts)
// loads the cookie and the profile, and these decide. Roles come from profiles (admin, hospital,
// insurer); row-level security in supabase/migrations enforces the same in the database.
import type { FacilitySource, ProfileRow, StaffRole } from "@/lib/db/types";
import { DEMO_ACCOUNTS, SESSION_HOURS, type DemoAccount } from "./demo";
import { readToken, signToken } from "./token";

export type Staff = {
  /** "demo": the rehearsal login, demo data only. "account": a real account in Supabase Auth. */
  kind: "demo" | "account";
  userId: string | null;
  role: StaffRole;
  facilityId: string | null;
  insurerId: string | null;
  name: string;
  /** "Front desk", "Admin", or the email for a real account. */
  title: string;
  email: string | null;
  mustChangePassword: boolean;
};

export function staffFromDemo(a: DemoAccount): Staff {
  return {
    kind: "demo",
    userId: null,
    role: a.role,
    facilityId: a.role === "hospital" ? a.facilityId : null,
    insurerId: a.role === "insurer" ? a.insurerId : null,
    name: a.name,
    title: a.title,
    email: null,
    mustChangePassword: false,
  };
}

export const ACCOUNT_COOKIE = "veriq_account";

export function makeAccountSession(userId: string, secret: string, now: Date): string {
  return signToken({ uid: userId, iat: now.getTime(), exp: now.getTime() + SESSION_HOURS * 60 * 60 * 1000 }, secret);
}

/** The user id and issue time in a valid, unexpired account cookie, or null. */
export function readAccountSession(cookie: string | undefined, secret: string, now: Date): { userId: string; issuedAt: number } | null {
  const p = readToken(cookie, secret);
  if (!p || typeof p.uid !== "string" || typeof p.iat !== "number" || typeof p.exp !== "number") return null;
  if (p.exp <= now.getTime()) return null;
  return { userId: p.uid, issuedAt: p.iat };
}

/**
 * The signed-in account, or null when the profile is missing or disabled, or the session was issued
 * before a password reset or the account was disabled (sessions_valid_after).
 */
export function staffFromProfile(profile: ProfileRow | null, issuedAt: number): Staff | null {
  if (!profile || profile.disabled_at) return null;
  if (issuedAt < Date.parse(profile.sessions_valid_after)) return null;
  return {
    kind: "account",
    userId: profile.user_id,
    role: profile.role,
    facilityId: profile.role === "hospital" ? profile.facility_id : null,
    insurerId: profile.role === "insurer" ? profile.insurer_id : null,
    name: profile.display_name || profile.email || "Staff",
    title: profile.email ?? "",
    email: profile.email,
    mustChangePassword: profile.must_change_password,
  };
}

/** The staff area a role works in: /admin, /h or /i. */
export const HOME: Record<StaffRole, string> = { admin: "/admin", hospital: "/h/check", insurer: "/i/network" };

/** Only paths inside a staff area are followed after sign-in (no open redirects). */
export function safeNext(next: string | null | undefined, role?: StaffRole): string {
  if (next && /^\/(h|i|admin)(\/[a-z0-9/-]*)?$/.test(next)) return next;
  return role ? HOME[role] : "/staff/sign-in";
}

/** Prompt 10: only a verified hospital's own staff publish a morning check or hospital answers. */
export function canPublish(staff: Staff | null, facility: { id: string; verified: boolean } | null): boolean {
  return staff?.role === "hospital" && !!facility && staff.facilityId === facility.id && facility.verified;
}

/**
 * Admin actions. A real admin acts on anything; the demo admin (rehearsals) acts only on demo
 * facilities, never on real ones or on staff accounts, because the demo login is open to anyone.
 */
export function adminMayAct(staff: Staff | null, target: { source: FacilitySource } | "accounts"): boolean {
  if (staff?.role !== "admin") return false;
  if (staff.kind === "account") return true;
  return target !== "accounts" && target.source === "demo";
}

/** Who did it, for the admin log. */
export function actorLabel(staff: Staff): string {
  return staff.kind === "demo" ? "Demo admin" : (staff.email ?? staff.userId ?? "Admin");
}

export const DEMO_ADMIN = staffFromDemo(DEMO_ACCOUNTS.find((a) => a.role === "admin")!);
