"use server";

import { redirect } from "next/navigation";
import { DEMO_ACCOUNTS } from "./demo";
import { signInDemo, signOut } from "./session";

const SAFE_NEXT = /^\/(h|i)\/[a-z/]*$/;

/** "Demo login" button (Phase 1 only). */
export async function demoSignIn(formData: FormData): Promise<void> {
  const key = String(formData.get("account"));
  const account = DEMO_ACCOUNTS.find((a) => a.key === key);
  if (!account) throw new Error("Unknown demo account.");
  await signInDemo(account.key);
  const next = String(formData.get("next") ?? "");
  redirect(SAFE_NEXT.test(next) ? next : account.role === "hospital" ? "/h/check" : "/i/network");
}

export async function staffSignOut(formData: FormData): Promise<void> {
  await signOut();
  const next = String(formData.get("next") ?? "");
  redirect(SAFE_NEXT.test(next) ? next : "/find");
}
