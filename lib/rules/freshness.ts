// Rule F: how fresh a service's status is, from its newest status_updates row.
import { DAY_MS, HOUR_MS, agoText, ageMs } from "./time";

/** "ended": the row's until_time has passed, so it no longer counts as current (rule F). */
export type FreshnessState = "fresh" | "aging" | "stale" | "ended" | "none";

export type Freshness = {
  state: FreshnessState;
  /** null when there has never been an update. */
  ageMs: number | null;
  /** "updated 40 min ago", or null when there has never been an update. */
  updatedText: string | null;
  /** Extra words shown with the status, or null when fresh. */
  warning: string | null;
  /** Over 72 hours, or past its until_time: shown greyed. */
  greyed: boolean;
};

export type StatusTiming = { created_at: string; until_time?: string | null };

/**
 * rule F: has the row's until_time ("HH:MM:SS", Accra time) passed? It is read on the day of the
 * update; a time earlier than the update means the next day ("open till 2 am"). Accra is on UTC
 * all year, so UTC clock times are Accra times.
 */
export function untilPassed(status: StatusTiming, now: Date): boolean {
  if (!status.until_time) return false;
  const created = new Date(status.created_at);
  const [h = 0, m = 0, sec = 0] = status.until_time.split(":").map(Number);
  let deadline = Date.UTC(created.getUTCFullYear(), created.getUTCMonth(), created.getUTCDate(), h, m, sec);
  if (deadline <= created.getTime()) deadline += DAY_MS;
  return now.getTime() >= deadline;
}

const AGING_FROM_HOURS = 24;
const STALE_AFTER_HOURS = 72;

export function freshness(status: StatusTiming | null, now: Date): Freshness {
  // rule F: no row ever.
  if (!status) return { state: "none", ageMs: null, updatedText: null, warning: "No update yet", greyed: false };

  const age = ageMs(status.created_at, now);
  const updatedText = `updated ${agoText(age)}`;

  // rule F: once the until_time has passed, the status no longer counts as current. The screen
  // words it "Was {status} till {time}. Call to check" (lib/view/status.ts).
  if (untilPassed(status, now)) return { state: "ended", ageMs: age, updatedText, warning: null, greyed: true };

  // rule F: under 24 hours is shown normally with the time.
  if (age < AGING_FROM_HOURS * HOUR_MS) return { state: "fresh", ageMs: age, updatedText, warning: null, greyed: false };
  // rule F: 24 to 72 hours (both included) adds "may have changed".
  if (age <= STALE_AFTER_HOURS * HOUR_MS) {
    return { state: "aging", ageMs: age, updatedText, warning: "may have changed", greyed: false };
  }
  // rule F: over 72 hours is greyed with "not updated recently".
  return { state: "stale", ageMs: age, updatedText, warning: "not updated recently", greyed: true };
}
