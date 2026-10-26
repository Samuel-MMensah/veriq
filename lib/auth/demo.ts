// The "Demo login" for three seeded demo accounts (SPEC section 5): a signed, httpOnly cookie, not a
// real login. Since Prompt 10 it is for rehearsals and tests only, and off on the real site
// (DEMO_LOGIN=off). Real staff sign in with an account (account.ts).
import { signToken, readToken } from "./token";

export type DemoAccount =
  | { key: "hospital-akoma"; role: "hospital"; facilityId: string; name: string; title: string; phone: string }
  | { key: "insurer-nhis"; role: "insurer"; insurerId: string; name: string; title: string; phone: string }
  | { key: "admin-demo"; role: "admin"; name: string; title: string; phone: string };

/** Demo only. Invented people; phone numbers deliberately invalid. */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    key: "hospital-akoma",
    role: "hospital",
    facilityId: "f0000000-0000-4000-8000-000000000001",
    name: "Esi",
    title: "Front desk",
    phone: "+233000000101",
  },
  {
    key: "insurer-nhis",
    role: "insurer",
    insurerId: "a0000000-0000-4000-8000-000000000001",
    name: "Kojo",
    title: "Network team",
    phone: "+233000000102",
  },
  { key: "admin-demo", role: "admin", name: "Presenter", title: "Veriq demo", phone: "+233000000103" },
];

export const SESSION_COOKIE = "veriq_staff";
export const SESSION_HOURS = 8;

export function makeSession(key: DemoAccount["key"], secret: string, now: Date): string {
  return signToken({ key, exp: now.getTime() + SESSION_HOURS * 60 * 60 * 1000 }, secret);
}

/** The signed-in demo account, or null if the cookie is missing, altered, expired or unknown. */
export function readSession(cookie: string | undefined, secret: string, now: Date): DemoAccount | null {
  const payload = readToken(cookie, secret);
  if (!payload || typeof payload.exp !== "number" || payload.exp <= now.getTime()) return null;
  return DEMO_ACCOUNTS.find((a) => a.key === payload.key) ?? null;
}
