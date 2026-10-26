// Staff passwords (Prompt 10). No email or SMS is sent: an admin hands the person a one-time password,
// and the person sets their own on first sign-in. Server only (node:crypto).
import { randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";

export const MIN_PASSWORD = 10;
const MAX_PASSWORD = 128;

// No 0/O, 1/l/I: easy to read out and type from a note.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** A one-time password like "k7qm-4tzp-9wxr" (12 symbols, about 59 bits). */
export function oneTimePassword(): string {
  const pick = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${pick()}-${pick()}-${pick()}`;
}

/** Trimmed and lower-cased, or null if it isn't an email address. */
export function normaliseEmail(text: string): string | null {
  const email = text.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null;
}

/** Why a new password can't be used, in plain words, or null when it's fine. */
export function newPasswordProblem(password: string, { repeat, email, oneTime }: { repeat: string; email: string | null; oneTime?: string }): string | null {
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (password.length > MAX_PASSWORD) return `Use at most ${MAX_PASSWORD} characters.`;
  if (password !== repeat) return "The two passwords are not the same.";
  if (oneTime && password === oneTime) return "Choose a new password, not the one you were given.";
  const name = email?.split("@")[0];
  if (name && name.length >= 3 && password.toLowerCase().includes(name)) return "Don't use your email address in your password.";
  if (new Set(password).size < 4) return "That password is too easy to guess.";
  return null;
}

// Local data mode only (lib/auth/backend.ts): Supabase hashes real passwords itself.
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("base64url")}$${scryptSync(password, salt, 32).toString("base64url")}`;
}

export function passwordMatches(password: string, stored: string | null): boolean {
  const [kind, salt, hash] = (stored ?? "").split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const given = scryptSync(password, Buffer.from(salt, "base64url"), 32);
  const expected = Buffer.from(hash, "base64url");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

const FAILURE_LIMIT = 5;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

/** Slows guessing: after 5 wrong passwords for one email in 15 minutes, wait until the oldest is 15 minutes old. */
export function signInBlocked(failures: number[], now: Date): boolean {
  return failures.filter((t) => now.getTime() - t < FAILURE_WINDOW_MS).length >= FAILURE_LIMIT;
}
