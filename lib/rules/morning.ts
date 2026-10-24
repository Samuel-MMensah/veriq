// Rule M: the hospital's morning check. Pure functions; the server action writes what they plan.
import type { HospitalResponseKind, HospitalSays, ReportItem, ReportOutcome, ReportState, ServiceStatus } from "@/lib/db/types";
import { median, roundToNearest5 } from "./topup";
import { HOUR_MS, ageMs, withinDays } from "./time";

export type StatusOption = { status: ServiceStatus; label: string };

const CAPACITY: StatusOption[] = [
  { status: "accepting", label: "Accepting" },
  { status: "full", label: "Full" },
];
const CLINIC: StatusOption[] = [
  { status: "open", label: "Open" },
  { status: "closed", label: "Closed" },
];
const MACHINE: StatusOption[] = [
  { status: "working", label: "Working" },
  { status: "down", label: "Down" },
];
const SPECIALIST: StatusOption[] = [
  { status: "open", label: "Here now" },
  { status: "from_time", label: "From" },
  { status: "closed", label: "Not today" },
];

const KIND: Record<string, StatusOption[]> = {
  emergency: CAPACITY,
  delivery: CAPACITY,
  c_section: CAPACITY,
  ultrasound: MACHINE,
  xray: MACHINE,
  ct: MACHINE,
  lab: MACHINE,
  obstetrician: SPECIALIST,
};

/** The choices on the morning check for one service (screen 16). Clinics are Open or Closed. */
export function optionsFor(serviceId: string): StatusOption[] {
  return KIND[serviceId] ?? CLINIC;
}

export type CurrentStatusLike = {
  service_id: string;
  status: ServiceStatus;
  from_time: string | null;
  note: string | null;
  created_at: string;
};

export type SubmittedStatus = { serviceId: string; status: ServiceStatus; fromTime: string | null };
export type PlannedStatusRow = { serviceId: string; status: ServiceStatus; fromTime: string | null; note: string | null };

/** An unchanged status is re-confirmed when its row is older than this, so a daily check keeps it fresh (rule F). */
export const RECONFIRM_AFTER_HOURS = 12;
const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * rule M: one status_updates row per changed service. "Changed" means a different status or time,
 * or the same status last written more than 12 hours ago (team decision 2026-10-24: confirming an
 * unchanged status every morning must keep it fresh under rule F).
 */
export function planStatusRows({
  current,
  submitted,
  now,
}: {
  current: CurrentStatusLike[];
  submitted: SubmittedStatus[];
  now: Date;
}): PlannedStatusRow[] {
  return submitted.flatMap((s) => {
    if (!optionsFor(s.serviceId).some((o) => o.status === s.status)) {
      throw new Error(`"${s.status}" doesn't fit ${s.serviceId}.`);
    }
    if (s.status === "from_time" && (!s.fromTime || !HH_MM.test(s.fromTime))) {
      throw new Error(`Choose a time for ${s.serviceId}.`);
    }
    const fromTime = s.status === "from_time" ? s.fromTime : null;
    const existing = current.find((c) => c.service_id === s.serviceId);
    const sameTime = (existing?.from_time ?? "").slice(0, 5) === (fromTime ?? "");
    const unchanged = existing && existing.status === s.status && sameTime;
    if (unchanged && ageMs(existing.created_at, now) <= RECONFIRM_AFTER_HOURS * HOUR_MS) return [];
    return [{ serviceId: s.serviceId, status: s.status, fromTime, note: unchanged ? existing.note : null }];
  });
}

export type CardLinkLike = { insurer_id: string; hospital_says: HospitalSays | null; hospital_confirmed_at: string | null };
export type CardAnswer = { insurerId: string; says: HospitalSays };
export type CardConfirmation = { insurerId: string; hospital_says: HospitalSays; hospital_confirmed_at: string };

/** rule M: set hospital_confirmed_at for every card they confirm (only cards already linked to them). */
export function planCardConfirmations({
  links,
  answers,
  now,
}: {
  links: CardLinkLike[];
  answers: CardAnswer[];
  now: Date;
}): CardConfirmation[] {
  return answers
    .filter((a) => links.some((l) => l.insurer_id === a.insurerId))
    .map((a) => ({ insurerId: a.insurerId, hospital_says: a.says, hospital_confirmed_at: now.toISOString() }));
}

const WEEK_DAYS = 7;

/** rule M: the weekly card check asks again when a card wasn't confirmed in the last 7 days. */
export function cardCheckDue(link: { hospital_confirmed_at: string | null }, now: Date): boolean {
  return !link.hospital_confirmed_at || !withinDays(link.hospital_confirmed_at, now, WEEK_DAYS);
}

export type PromptReport = {
  insurer_id: string;
  outcome: ReportOutcome;
  item: ReportItem | null;
  amount_ghs: number | null;
  created_at: string;
  state?: ReportState;
};
export type PromptResponse = { insurer_id: string; kind: HospitalResponseKind; item: ReportItem | null; created_at: string };
export type TopUpPrompt = { insurerId: string; item: ReportItem; count: number; amountGhs: number };

/**
 * rule M with rule T: "3 patients said they paid GH¢ 80 for an NHIS scan this week. Is that right?"
 * Asked when at least 2 live top-up reports for the same card and item came in the last 7 days,
 * until the hospital answers after the newest of them.
 */
export function topUpPrompts({
  reports,
  responses,
  now,
}: {
  reports: PromptReport[];
  responses: PromptResponse[];
  now: Date;
}): TopUpPrompt[] {
  const groups = new Map<string, PromptReport[]>();
  for (const r of reports) {
    if ((r.state ?? "live") !== "live" || r.outcome !== "topup" || !r.item || r.amount_ghs === null) continue;
    if (!withinDays(r.created_at, now, WEEK_DAYS)) continue;
    const key = `${r.insurer_id}|${r.item}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const prompts: TopUpPrompt[] = [];
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    const [insurerId, item] = key.split("|") as [string, ReportItem];
    const newest = Math.max(...group.map((r) => new Date(r.created_at).getTime()));
    const answered = responses.some(
      (x) =>
        x.insurer_id === insurerId &&
        x.item === item &&
        (x.kind === "confirm_topup" || x.kind === "correct_topup") &&
        new Date(x.created_at).getTime() > newest,
    );
    if (answered) continue;
    prompts.push({ insurerId, item, count: group.length, amountGhs: roundToNearest5(median(group.map((r) => r.amount_ghs!))) });
  }
  return prompts.sort((a, b) => b.count - a.count || a.insurerId.localeCompare(b.insurerId));
}

/** rule M: staff get an SMS reminder at 07:30 Accra time (UTC, no daylight saving), once a day. */
export const REMINDER_MINUTES = 7 * 60 + 30;

export function reminderDue(now: Date, lastSentDay: string | null): boolean {
  const today = now.toISOString().slice(0, 10);
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return minutes >= REMINDER_MINUTES && lastSentDay !== today;
}
