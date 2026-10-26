// Reading and setting staff sessions in server components and server actions (Prompt 10).
// A real account has a signed veriq_account cookie, checked against its profile on every request,
// so disabling an account or resetting its password ends its sessions at once. The demo login
// (veriq_staff) is for rehearsals and tests only, and off on the real site (DEMO_LOGIN=off).
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { isLocalData, serviceDb } from "@/lib/db/server";
import type { ProfileRow, StaffRole } from "@/lib/db/types";
import { SESSION_COOKIE, SESSION_HOURS, makeSession, readSession, type DemoAccount } from "./demo";
import { ACCOUNT_COOKIE, makeAccountSession, readAccountSession, staffFromDemo, staffFromProfile, type Staff } from "./staff";

const LOCAL_ONLY_SECRET = "local-data-mode-only";

function secret(): string {
  return process.env.SESSION_SECRET || (isLocalData() ? LOCAL_ONLY_SECRET : "");
}

/** Demo login is on unless DEMO_LOGIN=off, which every real deploy sets (docs/DEPLOY.md). */
export function demoLoginEnabled(): boolean {
  return process.env.DEMO_LOGIN !== "off";
}

const COOKIE_OPTIONS = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production" && !isLocalData(),
  path: "/",
  maxAge: SESSION_HOURS * 60 * 60,
});

export async function loadProfile(userId: string): Promise<ProfileRow | null> {
  const { data } = await (await serviceDb()).from("profiles").select("*").eq("user_id", userId).maybeSingle();
  return (data as ProfileRow | null) ?? null;
}

/** The signed-in staff member for this request, or null. A real account wins over the demo login. */
export const currentStaff = cache(async (): Promise<Staff | null> => {
  const jar = await cookies();
  const now = new Date();
  const account = readAccountSession(jar.get(ACCOUNT_COOKIE)?.value, secret(), now);
  if (account) {
    const staff = staffFromProfile(await loadProfile(account.userId), account.issuedAt);
    if (staff) return staff;
  }
  if (!demoLoginEnabled()) return null;
  const demo = readSession(jar.get(SESSION_COOKIE)?.value, secret(), now);
  return demo ? staffFromDemo(demo) : null;
});

export async function signInDemo(key: DemoAccount["key"]): Promise<void> {
  if (!demoLoginEnabled()) throw new Error("Demo login is off.");
  const jar = await cookies();
  jar.delete(ACCOUNT_COOKIE);
  jar.set(SESSION_COOKIE, makeSession(key, secret(), new Date()), COOKIE_OPTIONS());
}

export async function signInAccount(userId: string, now: Date): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.set(ACCOUNT_COOKIE, makeAccountSession(userId, secret(), now), COOKIE_OPTIONS());
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(ACCOUNT_COOKIE);
}

export type Gate = { ok: true; staff: Staff } | { ok: false; staff: Staff | null };

/**
 * For staff pages: the signed-in staff member when their role may open this area. Someone who must
 * still set their own password is sent to do that first.
 */
export async function staffGate(role: StaffRole, path: string): Promise<Gate> {
  const staff = await currentStaff();
  if (staff?.mustChangePassword) redirect(`/staff/password?next=${encodeURIComponent(path)}`);
  return staff?.role === role ? { ok: true, staff } : { ok: false, staff };
}

/** For server actions: the staff member, or a redirect to `path` (which shows sign-in or "not for you"). */
export async function requireStaff(role: StaffRole, path: string): Promise<Staff> {
  const staff = await currentStaff();
  if (!staff || staff.role !== role || staff.mustChangePassword) redirect(path);
  return staff;
}
