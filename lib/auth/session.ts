// Reading and setting the demo staff session in server components and server actions.
import { cookies } from "next/headers";
import { isLocalData } from "@/lib/db/server";
import { SESSION_COOKIE, SESSION_HOURS, makeSession, readSession, type DemoAccount } from "./demo";

const LOCAL_ONLY_SECRET = "local-data-mode-only";

function secret(): string {
  return process.env.SESSION_SECRET || (isLocalData() ? LOCAL_ONLY_SECRET : "");
}

/** Demo login is on in Phase 1. Set DEMO_LOGIN=off to hide it (e.g. on a real pilot deploy). */
export function demoLoginEnabled(): boolean {
  return process.env.DEMO_LOGIN !== "off";
}

export async function currentStaff(): Promise<DemoAccount | null> {
  if (!demoLoginEnabled()) return null;
  return readSession((await cookies()).get(SESSION_COOKIE)?.value, secret(), new Date());
}

export async function signInDemo(key: DemoAccount["key"]): Promise<void> {
  if (!demoLoginEnabled()) throw new Error("Demo login is off.");
  (await cookies()).set(SESSION_COOKIE, makeSession(key, secret(), new Date()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !isLocalData(),
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  });
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
