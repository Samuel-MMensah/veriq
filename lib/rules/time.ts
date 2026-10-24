// Time helpers shared by the rules. Every rule takes `now` so tests can fix the time.

export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** How long ago `at` was. A time in the future counts as now. */
export function ageMs(at: string, now: Date): number {
  return Math.max(0, now.getTime() - new Date(at).getTime());
}

/** True when `at` is within the last `days` days, boundary included ("last 30 days" includes exactly 30). */
export function withinDays(at: string, now: Date, days: number): boolean {
  return ageMs(at, now) <= days * DAY_MS;
}

/** "just now" under a minute, otherwise "40 min ago", "2 days ago". */
export function agoText(ms: number): string {
  return ms < MINUTE_MS ? "just now" : `${formatAge(ms)} ago`;
}

/** Plain-words age: "just now", "40 min", "2 h", "1 day", "3 days" (rule 9). */
export function formatAge(ms: number): string {
  if (ms < MINUTE_MS) return "just now";
  if (ms < HOUR_MS) return `${Math.floor(ms / MINUTE_MS)} min`;
  if (ms < DAY_MS) return `${Math.floor(ms / HOUR_MS)} h`;
  const days = Math.floor(ms / DAY_MS);
  return days === 1 ? "1 day" : `${days} days`;
}
