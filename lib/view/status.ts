// How a service's status reads on screen, with its source and age (rules F and 4).
import type { CurrentStatusRow, ServiceStatus, StatusSource } from "@/lib/db/types";
import { freshness, type Freshness } from "@/lib/rules/freshness";

export type StatusTone = "good" | "later" | "bad" | "unknown";

const WORD: Record<ServiceStatus, string> = {
  open: "Open",
  closed: "Closed",
  accepting: "Accepting",
  full: "Full",
  working: "Available",
  down: "Not working",
  from_time: "From",
};

const TONE: Record<ServiceStatus, StatusTone> = {
  open: "good",
  accepting: "good",
  working: "good",
  from_time: "later",
  closed: "bad",
  full: "bad",
  down: "bad",
};

/** "14:00:00" reads "2 pm"; "09:30:00" reads "9:30 am". */
export function clockFromTime(time: string): string {
  const [h = 0, m = 0] = time.split(":").map(Number);
  const suffix = h < 12 ? "am" : "pm";
  const hour = h % 12 || 12;
  return m ? `${hour}:${String(m).padStart(2, "0")} ${suffix}` : `${hour} ${suffix}`;
}

/** A time of day in Ghana, e.g. "7:40 am". */
export function accraClock(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Accra",
  }).format(new Date(iso));
}

export const SOURCE_LABEL: Record<StatusSource, string> = { hospital: "hospital", admin: "Veriq" };

export type StatusView = {
  /** "Open till 4 pm", "From 2 pm", "No update yet". */
  word: string;
  tone: StatusTone;
  freshness: Freshness;
  /** "updated by hospital 40 min ago", or null when never updated. */
  sourceText: string | null;
};

type StatusInput = Pick<CurrentStatusRow, "status" | "from_time" | "note" | "source" | "created_at"> & {
  until_time?: string | null;
};

function statusWord(status: StatusInput, ended: boolean): string {
  if (status.status === "from_time" && status.from_time) return `From ${clockFromTime(status.from_time)}`;
  if (status.until_time) {
    const till = clockFromTime(status.until_time);
    // rule F: past its until_time the status no longer counts as current.
    return ended ? `Was ${WORD[status.status].toLowerCase()} till ${till}. Call to check` : `${WORD[status.status]} till ${till}`;
  }
  return status.note ?? WORD[status.status];
}

export function statusView(status: StatusInput | null, now: Date): StatusView {
  const f = freshness(status, now);
  if (!status) return { word: "No update yet", tone: "unknown", freshness: f, sourceText: null };
  return {
    word: statusWord(status, f.state === "ended"),
    // rule F: a status over 72 hours old, or past its until_time, can't be trusted as good or bad.
    tone: f.state === "stale" || f.state === "ended" ? "unknown" : TONE[status.status],
    freshness: f,
    sourceText: f.updatedText ? f.updatedText.replace("updated", `updated by ${SOURCE_LABEL[status.source]}`) : null,
  };
}
