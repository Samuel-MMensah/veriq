// Dates on staff screens, in Ghana time (rule 4: every fact has a time).
import { accraClock } from "./status";

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Accra" });

/** "today, 2:04 pm", or "24 Oct 2026, 9:15 am". */
export function whenText(iso: string, now: Date): string {
  const day = DAY.format(new Date(iso));
  return `${day === DAY.format(now) ? "today" : day}, ${accraClock(iso)}`;
}
