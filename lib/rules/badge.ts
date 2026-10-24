// Rule B: the card badge for one facility and one insurer. Checked in order; the first match wins.
// Rule 5: only list, hospital-answer and report-outcome fields are read here.
import type { HospitalSays, ListedBy, ReportOutcome, ReportState } from "@/lib/db/types";
import { reportHistory, type ReportHistory } from "./history";
import { DAY_MS, agoText, ageMs, withinDays } from "./time";

export type BadgeId = "B1" | "B2" | "B2x" | "B3" | "B4" | "B5";
/** Colour family: B1 orange, B2 dark green, B3 light green, B4 grey. */
export type BadgeTone = "refused" | "hospital" | "hospital_no" | "patients" | "unchecked" | "unknown";

export type BadgeLink = {
  listed_by: ListedBy;
  hospital_says: HospitalSays | null;
  hospital_confirmed_at: string | null;
};

export type BadgeReport = {
  outcome: ReportOutcome;
  created_at: string;
  /** Absent means live (the public view only returns live reports). */
  state?: ReportState;
};

export type Badge = {
  id: BadgeId;
  tone: BadgeTone;
  text: string;
  /** Shown in card searches? B2x and B5 are left out (rules B2x, B5 and S1). */
  inCardSearch: boolean;
  /** Patients named in the text: refusals in the last 30 days for B1, accepted reports for B3. */
  count?: number;
  /** Accepted and refused over the last 7 days, 30 days and 12 months (team decision 2026-10-22). */
  history: ReportHistory;
};

/** The plain answer to "will they take my card here?" for each badge, shown above the badge text. */
export type Verdict = {
  /** One word for the hospital page: Yes, Unsure, Refused, No or Unknown. */
  short: "Yes" | "Unsure" | "Refused" | "No" | "Unknown";
  /** A few words for the result card, e.g. "Takes NHIS". */
  headline: string;
};

/** Rule B, worded as an answer. Only the badge id decides it, so it can never disagree with the badge. */
export function verdict(id: BadgeId, cardName: string): Verdict {
  switch (id) {
    case "B2": // rule B2: the hospital says yes
    case "B3": // rule B3: patients say yes
      return { short: "Yes", headline: `Takes ${cardName}` };
    case "B4": // rule B4: only a list says so
      return { short: "Unsure", headline: `${cardName} not confirmed yet` };
    case "B1": // rule B1: patients were refused
      return { short: "Refused", headline: `Patients report ${cardName} refusals` };
    case "B2x": // rule B2x: the hospital says no
      return { short: "No", headline: `Does not take ${cardName}` };
    case "B5": // rule B5: nothing known
      return { short: "Unknown", headline: `No ${cardName} information` };
  }
}

const REPORT_WINDOW_DAYS = 30;
const HOSPITAL_ANSWER_DAYS = 14;
const MIN_REPORTS = 3;

const isAccepted = (r: BadgeReport) => r.outcome === "covered" || r.outcome === "topup";
const isRefused = (r: BadgeReport) => r.outcome === "refused";

type BadgeInput = { link: BadgeLink | null; reports: BadgeReport[]; now: Date };

export function badge(input: BadgeInput): Badge {
  return { ...classify(input), history: reportHistory(input.reports, input.now) };
}

function classify({ link, reports, now }: BadgeInput): Omit<Badge, "history"> {
  // Rule A: held and rejected reports never count. Rule B: last 30 days only.
  const recent = reports.filter((r) => (r.state ?? "live") === "live" && withinDays(r.created_at, now, REPORT_WINDOW_DAYS));
  const confirmedAt = link?.hospital_confirmed_at ? new Date(link.hospital_confirmed_at).getTime() : null;
  const answerAgeMs = link?.hospital_confirmed_at ? ageMs(link.hospital_confirmed_at, now) : null;
  // The hospital's answer counts for 14 days, boundary included.
  const freshAnswerAgeMs = answerAgeMs !== null && answerAgeMs <= HOSPITAL_ANSWER_DAYS * DAY_MS ? answerAgeMs : null;

  // rule B1: at least 3 refusals newer than the hospital's answer, and more refused than accepted.
  // Both counts use only reports newer than the answer, so new refusals can't disappear behind older
  // accepted reports (team decision 2026-10-22). The text counts every refusal in the last 30 days.
  const sinceAnswer = confirmedAt === null ? recent : recent.filter((r) => new Date(r.created_at).getTime() > confirmedAt);
  const refusedSince = sinceAnswer.filter(isRefused).length;
  const acceptedSince = sinceAnswer.filter(isAccepted).length;
  if (refusedSince >= MIN_REPORTS && refusedSince > acceptedSince) {
    const refusedInWindow = recent.filter(isRefused).length;
    return {
      id: "B1",
      tone: "refused",
      text: `Listed, but ${refusedInWindow} patients were refused in the last 30 days`,
      inCardSearch: true,
      count: refusedInWindow,
    };
  }

  // rule B2: the hospital says accepts or partial, within 14 days.
  if (freshAnswerAgeMs !== null && (link?.hospital_says === "accepts" || link?.hospital_says === "partial")) {
    const withTopUps = link.hospital_says === "partial" ? " with top-ups" : "";
    return {
      id: "B2",
      tone: "hospital",
      text: `Confirmed by hospital ${agoText(freshAnswerAgeMs)}${withTopUps}`,
      inCardSearch: true,
    };
  }

  // rule B2x: the hospital says no, within 14 days.
  if (freshAnswerAgeMs !== null && link?.hospital_says === "does_not") {
    return { id: "B2x", tone: "hospital_no", text: "Not accepted (hospital)", inCardSearch: false };
  }

  // rule B3: at least 3 accepted reports, and more accepted than refused (last 30 days).
  const accepted = recent.filter(isAccepted).length;
  const refused = recent.filter(isRefused).length;
  if (accepted >= MIN_REPORTS && accepted > refused) {
    return {
      id: "B3",
      tone: "patients",
      text: `${accepted} patients confirmed in the last 30 days`,
      inCardSearch: true,
      count: accepted,
    };
  }

  // rule B4: on the NHIA or insurer list, not checked.
  if (link?.listed_by === "nhia" || link?.listed_by === "insurer") {
    const list = link.listed_by === "nhia" ? "NHIA" : "insurer";
    return { id: "B4", tone: "unchecked", text: `On ${list} list, not checked yet. Call first`, inCardSearch: true };
  }

  // rule B5: unknown. Shown only under "No card/cash".
  return { id: "B5", tone: "unknown", text: "Unknown", inCardSearch: false };
}
