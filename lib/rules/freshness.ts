// Rule F: how fresh a service's status is, from its newest status_updates row.
import { HOUR_MS, MINUTE_MS, ageMs, formatAge } from "./time";

export type FreshnessState = "fresh" | "aging" | "stale" | "none";

export type Freshness = {
  state: FreshnessState;
  /** null when there has never been an update. */
  ageMs: number | null;
  /** "updated 40 min ago", or null when there has never been an update. */
  updatedText: string | null;
  /** Extra words shown with the status, or null when fresh. */
  warning: string | null;
  /** Over 72 hours: shown greyed. */
  greyed: boolean;
};

const AGING_FROM_HOURS = 24;
const STALE_AFTER_HOURS = 72;

export function freshness(status: { created_at: string } | null, now: Date): Freshness {
  // rule F: no row ever.
  if (!status) return { state: "none", ageMs: null, updatedText: null, warning: "No update yet", greyed: false };

  const age = ageMs(status.created_at, now);
  const updatedText = age < MINUTE_MS ? "updated just now" : `updated ${formatAge(age)} ago`;

  // rule F: under 24 hours is shown normally with the time.
  if (age < AGING_FROM_HOURS * HOUR_MS) return { state: "fresh", ageMs: age, updatedText, warning: null, greyed: false };
  // rule F: 24 to 72 hours (both included) adds "may have changed".
  if (age <= STALE_AFTER_HOURS * HOUR_MS) {
    return { state: "aging", ageMs: age, updatedText, warning: "may have changed", greyed: false };
  }
  // rule F: over 72 hours is greyed with "not updated recently".
  return { state: "stale", ageMs: age, updatedText, warning: "not updated recently", greyed: true };
}
