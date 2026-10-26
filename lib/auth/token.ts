// Signed cookie values for staff sessions: base64url(JSON payload) + "." + HMAC-SHA256. Used by the
// demo login (demo.ts) and real accounts (account.ts). Server only.
import { createHmac, timingSafeEqual } from "node:crypto";

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url");

export function signToken(payload: Record<string, unknown>, secret: string): string {
  if (!secret) throw new Error("SESSION_SECRET is not set.");
  const body = b64(JSON.stringify(payload));
  return `${body}.${sign(body, secret)}`;
}

/** The payload, or null if the value is missing, altered or signed with another secret. */
export function readToken(value: string | undefined, secret: string): Record<string, unknown> | null {
  if (!value || !secret) return null;
  const [body, mac] = value.split(".");
  if (!body || !mac) return null;
  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as unknown;
    return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
