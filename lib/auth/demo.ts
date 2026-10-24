// Phase 1 staff sign-in: a "Demo login" for two seeded demo accounts (SPEC section 5). It is a
// signed, httpOnly cookie, not a real login. Prompt 9 replaces it with phone and email codes through
// Supabase Auth, using the row-level security policies already in supabase/migrations.
import { createHmac, timingSafeEqual } from "node:crypto";

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

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url");

export function makeSession(key: DemoAccount["key"], secret: string, now: Date): string {
  if (!secret) throw new Error("SESSION_SECRET is not set.");
  const payload = b64(JSON.stringify({ key, exp: now.getTime() + SESSION_HOURS * 60 * 60 * 1000 }));
  return `${payload}.${sign(payload, secret)}`;
}

/** The signed-in demo account, or null if the cookie is missing, altered, expired or unknown. */
export function readSession(cookie: string | undefined, secret: string, now: Date): DemoAccount | null {
  if (!cookie || !secret) return null;
  const [payload, mac] = cookie.split(".");
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { key, exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { key: string; exp: number };
    if (typeof exp !== "number" || exp <= now.getTime()) return null;
    return DEMO_ACCOUNTS.find((a) => a.key === key) ?? null;
  } catch {
    return null;
  }
}
