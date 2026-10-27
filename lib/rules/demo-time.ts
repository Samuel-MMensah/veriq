// Demo data only (rule 1): the "open till" time that "Reset demo data" gives Akoma's antenatal clinic
// and any other demo till time (rule F). It must read like a real clinic at whatever hour the reset
// runs, and must not turn into "Was open till …" during a pitch that follows the reset.
// The database does the same in public.demo_until_time() (migration 10); a test keeps them equal.
import { HOUR_MS } from "./time";

/** Never earlier than noon or later than 8 pm, Accra time. */
const EARLIEST_HOUR = 12;
const LATEST_HOUR = 20;
/** From this hour on, a reset gives plain "Open" with no till time. */
const NO_TILL_FROM_HOUR = 19;

/**
 * The till time ("HH:MM:SS", Accra time) for a demo reset at `resetAt`: reset + 4 hours to the
 * nearest hour, kept between 12:00 and 20:00. A reset at or after 19:00 gives null: "Open", no till.
 * Accra is on UTC all year, so UTC hours are Accra hours.
 */
export function demoUntilTime(resetAt: Date): string | null {
  if (resetAt.getUTCHours() >= NO_TILL_FROM_HOUR) return null;
  const later = new Date(resetAt.getTime() + 4 * HOUR_MS + 30 * 60 * 1000);
  // A reset before 19:00 plus 4.5 h is still the same day or just past midnight; past midnight only
  // happens above 20:00, which the clamp below brings back to 20:00.
  const sameDay = later.getUTCDate() === resetAt.getUTCDate();
  const hour = sameDay ? later.getUTCHours() : 24;
  const clamped = Math.min(LATEST_HOUR, Math.max(EARLIEST_HOUR, hour));
  return `${String(clamped).padStart(2, "0")}:00:00`;
}
