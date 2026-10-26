"use server";

import { redirect } from "next/navigation";
import { serviceDb } from "@/lib/db/server";
import { getAuthBackend } from "./backend";
import { DEMO_ACCOUNTS } from "./demo";
import { newPasswordProblem, normaliseEmail, signInBlocked } from "./password";
import { currentStaff, loadProfile, signInAccount, signInDemo, signOut } from "./session";
import { safeNext } from "./staff";

export type FormState = { error?: string; email?: string } | null;

/** "Demo login" button: rehearsals and tests only (off on the real site, DEMO_LOGIN=off). */
export async function demoSignIn(formData: FormData): Promise<void> {
  const key = String(formData.get("account"));
  const account = DEMO_ACCOUNTS.find((a) => a.key === key);
  if (!account) throw new Error("Unknown demo account.");
  await signInDemo(account.key);
  const next = String(formData.get("next") ?? "");
  redirect(safeNext(next, account.role));
}

// Wrong passwords per email, per server instance (lib/auth/password.ts signInBlocked).
const failures = globalThis as typeof globalThis & { __veriqSignInFailures?: Map<string, number[]> };
const failuresFor = (email: string) => (failures.__veriqSignInFailures ??= new Map()).get(email) ?? [];

const WRONG = "That email and password don't match an account.";

/** Staff sign-in with email and password (Prompt 10). Nothing is emailed or texted. */
export async function passwordSignIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const emailText = String(formData.get("email") ?? "");
  const email = normaliseEmail(emailText);
  const password = String(formData.get("password") ?? "");
  if (!email) return { error: "Type your email address, e.g. name@hospital.org.", email: emailText };
  if (!password) return { error: "Type your password.", email };

  const now = new Date();
  if (signInBlocked(failuresFor(email), now)) {
    return { error: "Too many wrong tries. Wait 15 minutes, or ask a Veriq admin to reset your password.", email };
  }
  const userId = await (await getAuthBackend()).checkPassword(email, password);
  const profile = userId ? await loadProfile(userId) : null;
  if (!userId || !profile) {
    failures.__veriqSignInFailures!.set(email, [...failuresFor(email), now.getTime()]);
    return { error: WRONG, email };
  }
  if (profile.disabled_at) return { error: "This account is switched off. Ask a Veriq admin.", email };
  failures.__veriqSignInFailures?.delete(email);

  await signInAccount(userId, now);
  const next = safeNext(String(formData.get("next") ?? ""), profile.role);
  redirect(profile.must_change_password ? `/staff/password?next=${encodeURIComponent(next)}` : next);
}

/** First sign-in (and any later change): the person sets their own password. */
export async function setOwnPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await currentStaff();
  if (staff?.kind !== "account" || !staff.userId) redirect("/staff/sign-in");
  const password = String(formData.get("password") ?? "");
  const problem = newPasswordProblem(password, {
    repeat: String(formData.get("repeat") ?? ""),
    email: staff.email,
    oneTime: String(formData.get("current") ?? "") || undefined,
  });
  if (problem) return { error: problem };

  const backend = await getAuthBackend();
  // Changing a password you already chose needs that password; the first one needs the one-time one.
  if (!staff.email || !(await backend.checkPassword(staff.email, String(formData.get("current") ?? "")))) {
    return { error: "Your current password is not right." };
  }
  await backend.setPassword(staff.userId, password);
  const now = new Date();
  // Every other session of this account ends; this one starts again.
  const { error } = await (await serviceDb())
    .from("profiles")
    .update({ must_change_password: false, sessions_valid_after: now.toISOString() })
    .eq("user_id", staff.userId);
  if (error) return { error: `Could not save: ${error.message}` };
  await signInAccount(staff.userId, now);
  redirect(`${safeNext(String(formData.get("next") ?? ""), staff.role)}?password=set`);
}

export async function staffSignOut(formData: FormData): Promise<void> {
  await signOut();
  const next = String(formData.get("next") ?? "");
  redirect(safeNext(next));
}
